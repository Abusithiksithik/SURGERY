-- =====================================================================
-- 05_indexes.sql
-- Performance indexes, views, materialized views, and functions.
--
-- FULLY IDEMPOTENT — safe to run on every startup, even when the
-- database already has an older version of these objects.
--
-- KEY DESIGN: v_completed_surgeries safe recreation
-- -------------------------------------------------
-- The original deployment may have created v_completed_surgeries using
-- SELECT s.* (expanding ALL surgeries columns), while the current
-- definition uses an explicit column list.  PostgreSQL's
-- CREATE OR REPLACE VIEW raises error 42P16 ("cannot drop columns
-- from view") when the new column list is a subset of the old one,
-- especially when dependent materialized views exist.
--
-- Fix strategy — inside a single DO block:
--   1. Detect whether v_completed_surgeries already exists.
--   2. If it does, drop the five dependent materialized views
--      (CASCADE would take them anyway, but we do it explicitly so we
--      can log and recreate them cleanly).
--   3. DROP VIEW v_completed_surgeries CASCADE.
--   4. CREATE the view fresh with the exact column list required.
--   5. Recreate all five materialized views WITH NO DATA.
--   6. Recreate their unique indexes.
-- This block is idempotent: if the view doesn't exist yet it skips
-- straight to CREATE; if it already matches, the DROP+CREATE is still
-- safe because matviews contain no user data (they are refreshed from
-- the surgeries table on demand).
-- =====================================================================

-- -----------------------------------------------------------------------
-- Regular indexes on high-cardinality filter / join columns
-- -----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_surgeries_status
    ON surgeries (status);

CREATE INDEX IF NOT EXISTS idx_surgeries_surgeon_id
    ON surgeries (surgeon_id);

CREATE INDEX IF NOT EXISTS idx_surgeries_surgery_type_id
    ON surgeries (surgery_type_id);

CREATE INDEX IF NOT EXISTS idx_surgeries_anaesthetist_id
    ON surgeries (anaesthetist_id);

CREATE INDEX IF NOT EXISTS idx_surgeries_branch_surgery_date
    ON surgeries (branch_id, surgery_date);

CREATE INDEX IF NOT EXISTS idx_budget_recommendations_surgery_id
    ON budget_recommendations (surgery_id);

CREATE INDEX IF NOT EXISTS idx_budget_recommendations_surgeon_surgery_type
    ON budget_recommendations (surgeon_id, surgery_type_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_overrides_surgery_id
    ON recommendation_overrides (surgery_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_overrides_component
    ON recommendation_overrides (component);

CREATE INDEX IF NOT EXISTS idx_surgery_alerts_surgery_id
    ON surgery_alerts (surgery_id);

CREATE INDEX IF NOT EXISTS idx_surgery_alerts_severity
    ON surgery_alerts (severity);

CREATE INDEX IF NOT EXISTS idx_surgery_alerts_alert_type
    ON surgery_alerts (alert_type);

CREATE INDEX IF NOT EXISTS idx_surgery_status_history_surgery_id
    ON surgery_status_history (surgery_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
    ON audit_log (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
    ON audit_log (changed_at);

-- alert_thresholds: uniqueness on (branch_id, alert_type) where
-- branch_id IS NULL means "global" — functional index handles NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_thresholds_branch_type
    ON alert_thresholds (
        COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::UUID),
        alert_type
    );

-- -----------------------------------------------------------------------
-- v_surgery_assistant_totals  (no dependents — simple CREATE OR REPLACE)
-- -----------------------------------------------------------------------

CREATE OR REPLACE VIEW v_surgery_assistant_totals AS
SELECT
    surgery_id,
    COUNT(*)        AS assistant_count,
    SUM(fee_amount) AS total_assistant_cost
FROM surgery_assistants
GROUP BY surgery_id;

-- -----------------------------------------------------------------------
-- v_completed_surgeries + dependent materialized views
--
-- Wrapped in a DO block so we can safely drop the old view (which may
-- have been created with SELECT s.* and therefore have a different,
-- incompatible column list) and its dependents before recreating them.
-- -----------------------------------------------------------------------

DO $$
DECLARE
    v_view_exists   BOOLEAN;
    v_needs_rebuild BOOLEAN := FALSE;
BEGIN
    -- Check whether v_completed_surgeries already exists
    SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_views
        WHERE schemaname = 'public'
          AND viewname   = 'v_completed_surgeries'
    ) INTO v_view_exists;

    IF v_view_exists THEN
        -- Always drop and recreate to guarantee the column list is correct.
        -- Materialized views contain NO user data (they are computed caches),
        -- so dropping them is safe — they will be recreated below.
        RAISE NOTICE 'Dropping dependent materialized views for safe view rebuild...';

        DROP MATERIALIZED VIEW IF EXISTS mv_monthly_financials  CASCADE;
        DROP MATERIALIZED VIEW IF EXISTS mv_ot_stats            CASCADE;
        DROP MATERIALIZED VIEW IF EXISTS mv_anaesthetist_stats  CASCADE;
        DROP MATERIALIZED VIEW IF EXISTS mv_surgery_type_stats  CASCADE;
        DROP MATERIALIZED VIEW IF EXISTS mv_surgeon_stats       CASCADE;

        DROP VIEW v_completed_surgeries CASCADE;

        RAISE NOTICE 'Old view dropped. Recreating with correct column list...';
        v_needs_rebuild := TRUE;
    END IF;

    -- ── CREATE v_completed_surgeries (explicit column list, no s.*) ──
    CREATE VIEW v_completed_surgeries AS
    SELECT
        s.surgery_id,
        s.branch_id,
        s.department_id,
        s.patient_id,
        s.surgeon_id,
        s.surgery_type_id,
        s.anaesthetist_id,
        s.status,
        s.patient_age_years,
        s.patient_gender,
        s.anaesthesia_type,
        s.surgery_date,
        s.ot_in_time,
        s.ot_out_time,
        s.duration_minutes,
        s.budget_total,
        s.actual_surgeon_fee,
        s.actual_assistant_cost,
        s.actual_anaesthetist_fee,
        s.actual_ot_cost,
        s.actual_consumables,
        s.actual_pharmacy,
        s.actual_miscellaneous,
        s.actual_total,
        s.quoted_price,
        s.collected_amount,
        s.profit_amount,
        s.is_outlier,
        -- Margin percentage (NULL when no quoted price)
        CASE
            WHEN s.quoted_price IS NOT NULL AND s.quoted_price > 0
            THEN ROUND((s.profit_amount / s.quoted_price) * 100, 2)
            ELSE NULL
        END AS margin_pct,
        -- Age group bucket used by the similarity engine
        CASE
            WHEN s.patient_age_years IS NULL THEN NULL
            WHEN s.patient_age_years < 13    THEN 'CHILD'
            WHEN s.patient_age_years < 30    THEN 'YOUNG_ADULT'
            WHEN s.patient_age_years < 50    THEN 'ADULT'
            WHEN s.patient_age_years < 65    THEN 'MIDDLE_AGED'
            ELSE                                  'SENIOR'
        END AS age_group,
        sg.full_name    AS surgeon_name,
        st.name         AS surgery_type_name,
        st.package_name AS package_name,
        an.full_name    AS anaesthetist_name
    FROM surgeries s
    JOIN  surgeons       sg ON sg.surgeon_id      = s.surgeon_id
    JOIN  surgery_types  st ON st.surgery_type_id = s.surgery_type_id
    LEFT JOIN anaesthetists an ON an.anaesthetist_id = s.anaesthetist_id
    WHERE s.status = 'COMPLETED';

    RAISE NOTICE 'v_completed_surgeries created (or already existed and was rebuilt).';

    -- ── MATERIALIZED VIEW: mv_surgeon_stats ──────────────────────────
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_surgeon_stats AS
    SELECT
        surgeon_id,
        surgery_type_id,
        COUNT(*)                                                                    AS case_count,
        AVG(actual_surgeon_fee)                                                     AS avg_fee,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY actual_surgeon_fee)             AS median_fee,
        MIN(actual_surgeon_fee)                                                     AS min_fee,
        MAX(actual_surgeon_fee)                                                     AS max_fee,
        STDDEV(actual_surgeon_fee)                                                  AS stddev_fee,
        AVG(profit_amount)                                                          AS avg_profit,
        AVG(CASE WHEN quoted_price > 0
                 THEN (profit_amount / quoted_price) * 100
                 ELSE NULL END)                                                     AS avg_margin_pct,
        AVG(duration_minutes)                                                       AS avg_duration_minutes,
        MAX(surgery_date)                                                           AS last_surgery_date
    FROM v_completed_surgeries
    WHERE actual_surgeon_fee IS NOT NULL
    GROUP BY surgeon_id, surgery_type_id
    WITH NO DATA;

    -- ── MATERIALIZED VIEW: mv_surgery_type_stats ─────────────────────
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_surgery_type_stats AS
    SELECT
        surgery_type_id,
        COUNT(*)                                                                    AS case_count,
        AVG(budget_total)                                                           AS avg_budget,
        AVG(actual_total)                                                           AS avg_actual_cost,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY actual_total)                  AS median_actual_cost,
        AVG(quoted_price)                                                           AS avg_quote,
        AVG(profit_amount)                                                          AS avg_profit,
        AVG(CASE WHEN quoted_price > 0
                 THEN (profit_amount / quoted_price) * 100
                 ELSE NULL END)                                                     AS avg_margin_pct,
        AVG(duration_minutes)                                                       AS avg_duration_minutes
    FROM v_completed_surgeries
    GROUP BY surgery_type_id
    WITH NO DATA;

    -- ── MATERIALIZED VIEW: mv_anaesthetist_stats ─────────────────────
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_anaesthetist_stats AS
    SELECT
        anaesthetist_id,
        anaesthesia_type,
        COUNT(*)                                                                    AS case_count,
        AVG(actual_anaesthetist_fee)                                                AS avg_fee,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY actual_anaesthetist_fee)       AS median_fee,
        MIN(actual_anaesthetist_fee)                                                AS min_fee,
        MAX(actual_anaesthetist_fee)                                                AS max_fee,
        STDDEV(actual_anaesthetist_fee)                                             AS stddev_fee
    FROM v_completed_surgeries
    WHERE anaesthetist_id IS NOT NULL
      AND actual_anaesthetist_fee IS NOT NULL
    GROUP BY anaesthetist_id, anaesthesia_type
    WITH NO DATA;

    -- ── MATERIALIZED VIEW: mv_ot_stats ───────────────────────────────
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ot_stats AS
    SELECT
        v.surgery_type_id,
        s.ot_room_id,
        COUNT(*)                                                                    AS case_count,
        AVG(v.duration_minutes)                                                     AS avg_duration_minutes,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.duration_minutes)            AS median_duration_minutes,
        MIN(v.duration_minutes)                                                     AS min_duration_minutes,
        MAX(v.duration_minutes)                                                     AS max_duration_minutes,
        AVG(v.actual_ot_cost)                                                       AS avg_ot_cost,
        AVG(CASE WHEN v.duration_minutes > 0
                 THEN v.actual_ot_cost / v.duration_minutes
                 ELSE NULL END)                                                     AS avg_cost_per_minute
    FROM v_completed_surgeries v
    JOIN surgeries s ON s.surgery_id = v.surgery_id
    WHERE v.duration_minutes IS NOT NULL
    GROUP BY v.surgery_type_id, s.ot_room_id
    WITH NO DATA;

    -- ── MATERIALIZED VIEW: mv_monthly_financials ─────────────────────
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_financials AS
    SELECT
        v.branch_id,
        v.department_id,
        DATE_TRUNC('month', v.surgery_date)::DATE                                  AS month,
        COUNT(*)                                                                    AS case_count,
        SUM(v.quoted_price)                                                         AS total_revenue,
        SUM(v.actual_total)                                                         AS total_cost,
        SUM(v.profit_amount)                                                        AS total_profit,
        AVG(CASE WHEN v.quoted_price > 0
                 THEN (v.profit_amount / v.quoted_price) * 100
                 ELSE NULL END)                                                     AS avg_margin_pct,
        SUM(v.collected_amount)                                                     AS total_collected
    FROM v_completed_surgeries v
    WHERE v.surgery_date IS NOT NULL
    GROUP BY v.branch_id, v.department_id, DATE_TRUNC('month', v.surgery_date)::DATE
    WITH NO DATA;

    RAISE NOTICE 'All materialized views created successfully.';
END $$;

-- -----------------------------------------------------------------------
-- Unique indexes on materialized views (IF NOT EXISTS = safe to re-run)
-- -----------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_surgeon_stats
    ON mv_surgeon_stats (surgeon_id, surgery_type_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_surgery_type_stats
    ON mv_surgery_type_stats (surgery_type_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_anaesthetist_stats
    ON mv_anaesthetist_stats (anaesthetist_id, COALESCE(anaesthesia_type, ''));

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ot_stats
    ON mv_ot_stats (
        surgery_type_id,
        COALESCE(ot_room_id, '00000000-0000-0000-0000-000000000000')
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_financials
    ON mv_monthly_financials (
        branch_id,
        COALESCE(department_id, '00000000-0000-0000-0000-000000000000'),
        month
    );

-- -----------------------------------------------------------------------
-- FUNCTION: fn_refresh_benchmark_views
-- Refreshes all five materialized views concurrently.
-- CREATE OR REPLACE is idempotent.
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_refresh_benchmark_views()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_surgeon_stats;
    REFRESH MATERIALIZED VIEW mv_surgery_type_stats;
    REFRESH MATERIALIZED VIEW mv_anaesthetist_stats;
    REFRESH MATERIALIZED VIEW mv_ot_stats;
    REFRESH MATERIALIZED VIEW mv_monthly_financials;
END;
$$;

COMMENT ON FUNCTION fn_refresh_benchmark_views IS
'Refreshes all benchmark materialized views concurrently. '
'Safe to call repeatedly. Requires the unique indexes to exist.';

-- -----------------------------------------------------------------------
-- FUNCTION: fn_similar_surgeries
-- Returns similarity-ranked completed surgeries for a target profile.
-- NOTE: Uses TEXT (not VARCHAR) for string return columns to match
--       the live DB table definitions. DROP+CREATE is required since
--       PostgreSQL disallows changing return types with CREATE OR REPLACE.
-- -----------------------------------------------------------------------

DROP FUNCTION IF EXISTS fn_similar_surgeries(UUID,UUID,UUID,VARCHAR,gender_type,VARCHAR,UUID,BOOLEAN,INT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC) CASCADE;

CREATE FUNCTION fn_similar_surgeries(
    p_surgery_type_id       UUID,
    p_surgeon_id            UUID,
    p_anaesthetist_id       UUID        DEFAULT NULL,
    p_age_group             VARCHAR     DEFAULT NULL,
    p_gender                gender_type DEFAULT NULL,
    p_package_name          VARCHAR     DEFAULT NULL,
    p_department_id         UUID        DEFAULT NULL,
    p_include_outliers      BOOLEAN     DEFAULT FALSE,
    p_limit                 INT         DEFAULT 10,
    p_w_surgeon_type        NUMERIC     DEFAULT 40,
    p_w_type                NUMERIC     DEFAULT 25,
    p_w_anaesthetist        NUMERIC     DEFAULT 12,
    p_w_age_group           NUMERIC     DEFAULT 8,
    p_w_gender              NUMERIC     DEFAULT 5,
    p_w_package             NUMERIC     DEFAULT 6,
    p_w_department          NUMERIC     DEFAULT 4
)
RETURNS TABLE (
    surgery_id               UUID,
    similarity_score         NUMERIC,
    surgery_date             DATE,
    mr_number                TEXT,
    patient_name             TEXT,
    patient_age_years        INT,
    patient_gender           gender_type,
    surgeon_name             TEXT,
    surgery_type_name        TEXT,
    anaesthetist_name        TEXT,
    anaesthesia_type         TEXT,
    duration_minutes         INT,
    actual_surgeon_fee       NUMERIC,
    assistant_count          INT,
    total_assistant_cost     NUMERIC,
    actual_anaesthetist_fee  NUMERIC,
    actual_ot_cost           NUMERIC,
    actual_consumables       NUMERIC,
    actual_pharmacy          NUMERIC,
    actual_miscellaneous     NUMERIC,
    actual_total             NUMERIC,
    quoted_price             NUMERIC,
    collected_amount         NUMERIC,
    profit_amount            NUMERIC,
    margin_pct               NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.surgery_id,
        (
            CASE WHEN v.surgery_type_id = p_surgery_type_id
                      AND v.surgeon_id  = p_surgeon_id
                 THEN p_w_surgeon_type ELSE 0 END
            +
            CASE WHEN v.surgery_type_id = p_surgery_type_id
                 THEN p_w_type ELSE 0 END
            +
            CASE WHEN p_anaesthetist_id IS NOT NULL
                      AND v.anaesthetist_id = p_anaesthetist_id
                 THEN p_w_anaesthetist ELSE 0 END
            +
            CASE WHEN p_age_group IS NOT NULL
                      AND v.age_group = p_age_group
                 THEN p_w_age_group ELSE 0 END
            +
            CASE WHEN p_gender IS NOT NULL
                      AND v.patient_gender = p_gender
                 THEN p_w_gender ELSE 0 END
            +
            CASE WHEN p_package_name IS NOT NULL
                      AND v.package_name = p_package_name
                 THEN p_w_package ELSE 0 END
            +
            CASE WHEN p_department_id IS NOT NULL
                      AND v.department_id = p_department_id
                 THEN p_w_department ELSE 0 END
        )::NUMERIC                                      AS similarity_score,
        v.surgery_date,
        p.mr_number::TEXT,
        p.full_name::TEXT                               AS patient_name,
        v.patient_age_years,
        v.patient_gender,
        v.surgeon_name::TEXT,
        v.surgery_type_name::TEXT,
        v.anaesthetist_name::TEXT,
        v.anaesthesia_type::TEXT,
        v.duration_minutes,
        v.actual_surgeon_fee,
        COALESCE(sat.assistant_count,    0)::INT        AS assistant_count,
        COALESCE(sat.total_assistant_cost, 0)           AS total_assistant_cost,
        v.actual_anaesthetist_fee,
        v.actual_ot_cost,
        v.actual_consumables,
        v.actual_pharmacy,
        v.actual_miscellaneous,
        v.actual_total,
        v.quoted_price,
        v.collected_amount,
        v.profit_amount,
        v.margin_pct
    FROM v_completed_surgeries v
    JOIN patients p ON p.patient_id = v.patient_id
    LEFT JOIN v_surgery_assistant_totals sat ON sat.surgery_id = v.surgery_id
    WHERE v.surgery_type_id = p_surgery_type_id
      AND (p_include_outliers OR v.is_outlier = FALSE)
    ORDER BY similarity_score DESC, v.surgery_date DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION fn_similar_surgeries IS
'Returns similarity-ranked completed surgeries for a target case profile. '
'Used by the Similar Surgery Explorer (higher p_limit, app-side pagination) '
'and the Recommendation Engine (p_limit ≤ 200).';


