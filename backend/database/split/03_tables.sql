-- =====================================================================
-- 03_tables.sql
-- All tables for the Hospital Surgery Cost Intelligence schema.
-- Every table uses CREATE TABLE IF NOT EXISTS — fully idempotent.
-- Foreign keys and unique constraints are in 04_constraints.sql.
-- =====================================================================

-- -----------------------------------------------------------------------
-- branches — top-level organisational unit
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
    branch_id    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_code  VARCHAR(20) NOT NULL,
    branch_name  VARCHAR(120) NOT NULL,
    city         VARCHAR(80),
    address      TEXT,
    is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- departments — belong to a branch
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    department_id    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id        UUID         NOT NULL,
    department_code  VARCHAR(20)  NOT NULL,
    department_name  VARCHAR(120) NOT NULL,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- users — system users / staff who log in
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id       UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id     UUID,
    username      VARCHAR(60)  NOT NULL,
    email         VARCHAR(120) NOT NULL,
    password_hash TEXT         NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    role          user_role    NOT NULL DEFAULT 'VIEWER',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP(3),
    created_at    TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- surgeons
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surgeons (
    surgeon_id      UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID         NOT NULL,
    department_id   UUID,
    employee_code   VARCHAR(30),
    full_name       VARCHAR(120) NOT NULL,
    specialization  VARCHAR(120),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- anaesthetists
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anaesthetists (
    anaesthetist_id UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID         NOT NULL,
    employee_code   VARCHAR(30),
    full_name       VARCHAR(120) NOT NULL,
    qualification   VARCHAR(120),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- assistants
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assistants (
    assistant_id  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id     UUID         NOT NULL,
    employee_code VARCHAR(30),
    full_name     VARCHAR(120) NOT NULL,
    role_title    VARCHAR(80),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- surgery_types — catalogue of procedure types
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surgery_types (
    surgery_type_id UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id   UUID,
    code            VARCHAR(30)  NOT NULL,
    name            VARCHAR(120) NOT NULL,
    package_name    VARCHAR(120),
    description     TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- ot_rooms — operating theatre rooms
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ot_rooms (
    ot_room_id      UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID         NOT NULL,
    room_code       VARCHAR(20)  NOT NULL,
    room_name       VARCHAR(80)  NOT NULL,
    cost_per_minute NUMERIC(8,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- patients
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    patient_id    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id     UUID         NOT NULL,
    mr_number     VARCHAR(30)  NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    date_of_birth DATE,
    gender        gender_type,
    phone         VARCHAR(20),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- consumable_items — master catalogue of consumables
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consumable_items (
    item_id       UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code     VARCHAR(30)  NOT NULL,
    item_name     VARCHAR(120) NOT NULL,
    unit          VARCHAR(20),
    standard_cost NUMERIC(10,2),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- pharmacy_items — master catalogue of pharmacy / drugs
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pharmacy_items (
    pharmacy_item_id UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code        VARCHAR(30)  NOT NULL,
    item_name        VARCHAR(120) NOT NULL,
    unit             VARCHAR(20),
    standard_cost    NUMERIC(10,2),
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- surgeries — the core fact table
-- GENERATED ALWAYS AS STORED columns handle computed totals in the DB.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surgeries (
    surgery_id       UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id        UUID            NOT NULL,
    department_id    UUID,
    patient_id       UUID            NOT NULL,
    surgeon_id       UUID            NOT NULL,
    anaesthetist_id  UUID,
    surgery_type_id  UUID            NOT NULL,
    ot_room_id       UUID,

    status           surgery_status  NOT NULL DEFAULT 'DRAFT',

    patient_age_years  INTEGER,
    patient_gender     gender_type,
    anaesthesia_type   TEXT,

    scheduled_date   DATE,
    surgery_date     DATE,
    ot_in_time       TIMESTAMP(3),
    ot_out_time      TIMESTAMP(3),

    -- Computed: minutes between ot_in_time and ot_out_time
    duration_minutes INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN ot_in_time IS NOT NULL AND ot_out_time IS NOT NULL
            THEN GREATEST(0, EXTRACT(EPOCH FROM (ot_out_time - ot_in_time)) / 60)::INTEGER
            ELSE NULL
        END
    ) STORED,

    -- Budget components
    budget_surgeon_fee       NUMERIC(12,2) NOT NULL DEFAULT 0,
    budget_assistant_cost    NUMERIC(12,2) NOT NULL DEFAULT 0,
    budget_anaesthetist_fee  NUMERIC(12,2) NOT NULL DEFAULT 0,
    budget_ot_cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
    budget_consumables       NUMERIC(12,2) NOT NULL DEFAULT 0,
    budget_pharmacy          NUMERIC(12,2) NOT NULL DEFAULT 0,
    budget_miscellaneous     NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Computed: sum of the 7 budget_* columns
    budget_total NUMERIC(12,2) GENERATED ALWAYS AS (
        COALESCE(budget_surgeon_fee, 0) + COALESCE(budget_assistant_cost, 0) +
        COALESCE(budget_anaesthetist_fee, 0) + COALESCE(budget_ot_cost, 0) +
        COALESCE(budget_consumables, 0) + COALESCE(budget_pharmacy, 0) +
        COALESCE(budget_miscellaneous, 0)
    ) STORED,

    -- Actual components
    actual_surgeon_fee       NUMERIC(12,2),
    actual_assistant_cost    NUMERIC(12,2),
    actual_anaesthetist_fee  NUMERIC(12,2),
    actual_ot_cost           NUMERIC(12,2),
    actual_consumables       NUMERIC(12,2),
    actual_pharmacy          NUMERIC(12,2),
    actual_miscellaneous     NUMERIC(12,2),

    -- Computed: sum of the 7 actual_* columns (NULLs treated as 0)
    actual_total NUMERIC(12,2) GENERATED ALWAYS AS (
        COALESCE(actual_surgeon_fee, 0) + COALESCE(actual_assistant_cost, 0) +
        COALESCE(actual_anaesthetist_fee, 0) + COALESCE(actual_ot_cost, 0) +
        COALESCE(actual_consumables, 0) + COALESCE(actual_pharmacy, 0) +
        COALESCE(actual_miscellaneous, 0)
    ) STORED,

    quoted_price      NUMERIC(12,2),
    collected_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Computed: quoted_price minus actual cost total
    -- (Cannot reference actual_total here; PG forbids generated → generated refs)
    profit_amount NUMERIC(12,2) GENERATED ALWAYS AS (
        COALESCE(quoted_price, 0) - (
            COALESCE(actual_surgeon_fee, 0) + COALESCE(actual_assistant_cost, 0) +
            COALESCE(actual_anaesthetist_fee, 0) + COALESCE(actual_ot_cost, 0) +
            COALESCE(actual_consumables, 0) + COALESCE(actual_pharmacy, 0) +
            COALESCE(actual_miscellaneous, 0)
        )
    ) STORED,

    is_outlier      BOOLEAN NOT NULL DEFAULT FALSE,
    outlier_reason  TEXT,

    created_by  UUID,
    updated_by  UUID,
    created_at  TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- surgery_assistants — many-to-many: surgery ↔ assistants
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surgery_assistants (
    surgery_assistant_id UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id           UUID         NOT NULL,
    assistant_id         UUID         NOT NULL,
    fee_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at           TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- surgery_consumables — line items: consumables used in a surgery
-- total_cost is a GENERATED column (quantity × unit_cost)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surgery_consumables (
    surgery_consumable_id UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id            UUID          NOT NULL,
    item_id               UUID          NOT NULL,
    quantity              NUMERIC(10,3) NOT NULL DEFAULT 1,
    unit_cost             NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_cost            NUMERIC(12,2) GENERATED ALWAYS AS (
                              ROUND(quantity * unit_cost, 2)
                          ) STORED,
    created_at            TIMESTAMP(3)  NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- surgery_pharmacy — line items: pharmacy / drugs used in a surgery
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surgery_pharmacy (
    surgery_pharmacy_id UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id          UUID          NOT NULL,
    pharmacy_item_id    UUID          NOT NULL,
    quantity            NUMERIC(10,3) NOT NULL DEFAULT 1,
    unit_cost           NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_cost          NUMERIC(12,2) GENERATED ALWAYS AS (
                            ROUND(quantity * unit_cost, 2)
                        ) STORED,
    created_at          TIMESTAMP(3)  NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- surgery_collections — payment instalments collected for a surgery
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surgery_collections (
    collection_id  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id     UUID         NOT NULL,
    amount         NUMERIC(12,2) NOT NULL,
    mode           payment_mode,
    collected_at   TIMESTAMP(3) NOT NULL DEFAULT now(),
    recorded_by    UUID,
    notes          TEXT,
    created_at     TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- budget_recommendations — AI-generated budget recommendations
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_recommendations (
    recommendation_id     UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id            UUID         NOT NULL,
    generated_by          UUID,
    surgeon_id            UUID         NOT NULL,
    surgery_type_id       UUID         NOT NULL,
    anaesthetist_id       UUID,
    sample_size           INTEGER      NOT NULL DEFAULT 0,
    outliers_excluded     BOOLEAN      NOT NULL DEFAULT TRUE,
    similarity_weights    JSONB,
    recommended_surgeon_fee       NUMERIC(12,2),
    recommended_assistant_cost    NUMERIC(12,2),
    recommended_anaesthetist_fee  NUMERIC(12,2),
    recommended_ot_cost           NUMERIC(12,2),
    recommended_ot_duration_minutes INTEGER,
    recommended_consumables       NUMERIC(12,2),
    recommended_pharmacy          NUMERIC(12,2),
    recommended_miscellaneous     NUMERIC(12,2),
    recommended_total             NUMERIC(12,2),
    recommended_quote             NUMERIC(12,2),
    recommended_margin_pct        NUMERIC(6,2),
    engine_output         JSONB,
    generated_at          TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- recommendation_overrides — log when a user deviates from a recommendation
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendation_overrides (
    override_id        UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommendation_id  UUID         NOT NULL,
    surgery_id         UUID         NOT NULL,
    component          recommendation_component NOT NULL,
    recommended_value  NUMERIC(12,2),
    overridden_value   NUMERIC(12,2),
    override_reason    TEXT         NOT NULL,
    overridden_by      UUID,
    overridden_at      TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- alert_thresholds — configurable thresholds per branch (or global)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_thresholds (
    threshold_id        UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id           UUID,
    alert_type          alert_type   NOT NULL,
    yellow_threshold_pct NUMERIC(6,2) NOT NULL DEFAULT 10,
    red_threshold_pct    NUMERIC(6,2) NOT NULL DEFAULT 25,
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_by           UUID,
    created_at           TIMESTAMP(3) NOT NULL DEFAULT now(),
    updated_at           TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- surgery_alerts — alerts fired for individual surgeries
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surgery_alerts (
    alert_id         UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id       UUID          NOT NULL,
    alert_type       alert_type    NOT NULL,
    severity         alert_severity NOT NULL DEFAULT 'GREEN',
    message          TEXT          NOT NULL,
    metric_value     NUMERIC(14,4),
    threshold_value  NUMERIC(14,4),
    is_acknowledged  BOOLEAN       NOT NULL DEFAULT FALSE,
    acknowledged_by  UUID,
    acknowledged_at  TIMESTAMP(3),
    created_at       TIMESTAMP(3)  NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- surgery_status_history — immutable audit trail of status transitions
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surgery_status_history (
    history_id     UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id     UUID          NOT NULL,
    from_status    surgery_status,
    to_status      surgery_status NOT NULL,
    changed_by     UUID,
    changed_at     TIMESTAMP(3)  NOT NULL DEFAULT now(),
    notes          TEXT
);

-- -----------------------------------------------------------------------
-- audit_log — generic field-level change log
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    log_id      UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name  VARCHAR(80)  NOT NULL,
    record_id   UUID         NOT NULL,
    action      VARCHAR(10)  NOT NULL,   -- INSERT | UPDATE | DELETE
    changed_by  UUID,
    changed_at  TIMESTAMP(3) NOT NULL DEFAULT now(),
    old_values  JSONB,
    new_values  JSONB
);
