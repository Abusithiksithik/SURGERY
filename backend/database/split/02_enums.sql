-- =====================================================================
-- 02_enums.sql
-- Custom PostgreSQL enum types for the Hospital Surgery Cost Intelligence schema.
-- Each type is created ONLY if it does not already exist, using a DO block
-- that checks pg_type — PostgreSQL has no CREATE TYPE IF NOT EXISTS syntax.
-- =====================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'surgery_status') THEN
        CREATE TYPE surgery_status AS ENUM (
            'DRAFT',
            'PENDING',
            'SCHEDULED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED',
            'DELETED'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
        CREATE TYPE gender_type AS ENUM (
            'MALE',
            'FEMALE',
            'OTHER',
            'UNKNOWN'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
        CREATE TYPE alert_severity AS ENUM (
            'GREEN',
            'YELLOW',
            'RED'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
        CREATE TYPE alert_type AS ENUM (
            'SURGEON_FEE_HIGH',
            'ASSISTANT_COST_HIGH',
            'OT_DURATION_LONG',
            'OT_COST_HIGH',
            'CONSUMABLES_HIGH',
            'MARGIN_BELOW_TARGET',
            'QUOTE_TOO_LOW',
            'NEGATIVE_PROFIT',
            'BUDGET_EXCEEDED',
            'ACTUAL_COST_MISSING',
            'COLLECTION_PENDING'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recommendation_component') THEN
        CREATE TYPE recommendation_component AS ENUM (
            'SURGEON_FEE',
            'ASSISTANT',
            'ANAESTHETIST',
            'OT',
            'CONSUMABLES',
            'PHARMACY',
            'MISCELLANEOUS'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM (
            'ADMIN',
            'MANAGER',
            'DOCTOR',
            'FINANCE',
            'VIEWER'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_mode') THEN
        CREATE TYPE payment_mode AS ENUM (
            'CASH',
            'CARD',
            'UPI',
            'INSURANCE',
            'CHEQUE',
            'NEFT',
            'OTHER'
        );
    END IF;
END $$;
