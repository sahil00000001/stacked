-- CreateSchema: Stacked keeps to its own schema in a shared database
CREATE SCHEMA IF NOT EXISTS "stacked";
SET search_path TO "stacked";

-- CreateEnum
CREATE TYPE "InsurerType" AS ENUM ('PSU_GI', 'PVT_GI', 'SAHI');

-- CreateEnum
CREATE TYPE "ProductDataStatus" AS ENUM ('verified', 'partial', 'name_only');

-- CreateEnum
CREATE TYPE "PolicyDataStatus" AS ENUM ('user_verified', 'parsed_from_wording', 'aggregator', 'name_only');

-- CreateEnum
CREATE TYPE "HolderRelationship" AS ENUM ('self', 'employer_group', 'parents_floater', 'spouse', 'other');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('individual', 'family_floater', 'multi_individual', 'group', 'senior', 'top_up', 'super_top_up', 'critical_illness', 'hospital_cash', 'personal_accident');

-- CreateTable
CREATE TABLE "insurers" (
    "insurer_id" TEXT NOT NULL,
    "insurer_name" TEXT NOT NULL,
    "insurer_type" "InsurerType" NOT NULL,
    "csr_fy24" DOUBLE PRECISION,
    "csr_fy25" DOUBLE PRECISION,
    "csr_fy26" DOUBLE PRECISION,
    "csr_3yr_avg" DOUBLE PRECISION,
    "icr_fy23" DOUBLE PRECISION,
    "icr_fy24" DOUBLE PRECISION,
    "icr_fy25" DOUBLE PRECISION,
    "health_gwp_fy26_cr" INTEGER,
    "complaints_per_10k_fy26" DOUBLE PRECISION,
    "complaints_3yr_avg" DOUBLE PRECISION,
    "network_hospitals_min" INTEGER,
    "flags" TEXT NOT NULL,
    "repudiation_ratio" DOUBLE PRECISION,
    "as_of" DATE NOT NULL,
    "source_url" TEXT NOT NULL,
    "metric_definition" TEXT NOT NULL,

    CONSTRAINT "insurers_pkey" PRIMARY KEY ("insurer_id")
);

-- CreateTable
CREATE TABLE "products" (
    "product_id" TEXT NOT NULL,
    "insurer_id" TEXT,
    "all_insurers" BOOLEAN NOT NULL DEFAULT false,
    "product_name" TEXT NOT NULL,
    "variant" TEXT,
    "product_type" "PolicyType",
    "uin" TEXT,
    "si_min" TEXT,
    "si_max" TEXT,
    "room_rent_rule" TEXT,
    "room_rent_value" TEXT,
    "copay_rule" TEXT,
    "ped_wait_months" INTEGER,
    "specific_wait_months" INTEGER,
    "restoration" TEXT,
    "bonus_pct_per_year" DOUBLE PRECISION,
    "bonus_max_pct" DOUBLE PRECISION,
    "bonus_reduces_on_claim" BOOLEAN,
    "pre_days" INTEGER,
    "post_days" INTEGER,
    "consumables" TEXT,
    "maternity" TEXT,
    "indicative_premium" TEXT,
    "known_features" TEXT,
    "sources" TEXT,
    "data_status" "ProductDataStatus" NOT NULL,
    "as_of" DATE NOT NULL,
    "source_url" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "scenario_id" TEXT NOT NULL,
    "scenario_name" TEXT NOT NULL,
    "room_rent" INTEGER NOT NULL,
    "copay" INTEGER NOT NULL,
    "sublimit" INTEGER NOT NULL,
    "initial_specific_wait" INTEGER NOT NULL,
    "ped_wait" INTEGER NOT NULL,
    "restoration" INTEGER NOT NULL,
    "consumables" INTEGER NOT NULL,
    "cashless_network" INTEGER NOT NULL,
    "pre_post_days" INTEGER NOT NULL,
    "maternity" INTEGER NOT NULL,
    "csr_weight" DOUBLE PRECISION NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("scenario_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "user_id" TEXT NOT NULL,
    "family_group_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("user_id","family_group_id")
);

-- CreateTable
CREATE TABLE "policies" (
    "policy_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "family_group_id" TEXT,
    "insurer_id" TEXT,
    "product_id" TEXT,
    "holder_relationship" "HolderRelationship" NOT NULL,
    "policy_type" "PolicyType" NOT NULL,
    "data" JSONB NOT NULL,
    "data_status" "PolicyDataStatus" NOT NULL,
    "source_url" TEXT,
    "as_of" DATE,
    "verified_by_user_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("policy_id")
);

-- CreateTable
CREATE TABLE "claim_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scenario" JSONB NOT NULL,
    "policies" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "engine_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_insurer_id_idx" ON "products"("insurer_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "policies_user_id_idx" ON "policies"("user_id");

-- CreateIndex
CREATE INDEX "claim_plans_user_id_idx" ON "claim_plans"("user_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_insurer_id_fkey" FOREIGN KEY ("insurer_id") REFERENCES "insurers"("insurer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_group_id_fkey" FOREIGN KEY ("family_group_id") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_family_group_id_fkey" FOREIGN KEY ("family_group_id") REFERENCES "family_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_insurer_id_fkey" FOREIGN KEY ("insurer_id") REFERENCES "insurers"("insurer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_plans" ADD CONSTRAINT "claim_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

