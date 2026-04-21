-- AlterEnum — SessionStatus : ajout LIVE + REPLACED
-- F1: Postgres interdit `ALTER TYPE ADD VALUE` + usage de la valeur dans la même tx.
-- Cette migration est volontairement SEULE pour que les nouveaux littéraux soient "visibles"
-- dans la migration suivante (20260422000002_subject_session_refactor).
ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'LIVE';
ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'REPLACED';
