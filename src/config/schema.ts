import { z } from "zod";

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Slug = z.string().regex(/^[a-z0-9_-]+$/);
const NonEmpty = z.string().min(1);

const Branding = z.object({
  facilityName: NonEmpty,
  logoUrl: z.string().url().optional(),
  primaryColor: HexColor.default("#2c5282"),
  accentColor: HexColor.default("#2b6cb0"),
  contactLine: z.string().optional(),
  billingPhone: z.string().optional(),
  footerDisclaimer: z
    .string()
    .default(
      "This is an estimate of benefits, not a guarantee of payment. Final amounts depend on your insurance company's processing of the claim, including what they allow, what they consider covered, and any plan limits.",
    ),
});

const Vocabulary = z
  .object({
    patientNoun: z
      .enum(["patient", "client", "member", "guest"])
      .default("patient"),
    episodeNoun: z.string().default("visit"),
    serviceNoun: z.string().default("service"),
    currency: z
      .object({
        symbol: z.string().default("$"),
        code: z.string().default("USD"),
        locale: z.string().default("en-US"),
      })
      .default({}),
  })
  .default({});

const CopayRuleEnum = z.enum([
  "no_copay",
  "copay_only",
  "copay_before_deductible",
  "copay_after_deductible",
  "copay_plus_coinsurance",
  "copay_instead_of_coinsurance",
  "unknown",
]);

const ServiceTier = z.object({
  id: Slug,
  label: NonEmpty,
  description: z.string().optional(),
  defaults: z
    .object({
      deductibleApplies: z.enum(["yes", "no", "unknown"]).optional(),
      coinsuranceApplies: z.enum(["yes", "no", "unknown"]).optional(),
      coinsurancePercent: z.number().min(0).max(100).optional(),
      copayApplies: z.enum(["yes", "no", "unknown"]).optional(),
      copayAmount: z.number().min(0).optional(),
      copayRule: CopayRuleEnum.optional(),
    })
    .partial()
    .optional(),
});

const FieldToggle = z.object({
  enabled: z.boolean().default(true),
  required: z.boolean().default(false),
  label: z.string().optional(),
  helpText: z.string().optional(),
});

const Fields = z
  .object({
    network: FieldToggle.default({}),
    deductible: FieldToggle.default({}),
    oopMax: FieldToggle.default({}),
    bucketStructure: FieldToggle.default({}),
    patientStatus: FieldToggle.default({}),
    currentTier: FieldToggle.default({}),
    verifiedTier: FieldToggle.default({}),
    deductibleApplies: FieldToggle.default({}),
    coinsurance: FieldToggle.default({}),
    copay: FieldToggle.default({}),
    copayRule: FieldToggle.default({}),
    estimateBasis: FieldToggle.default({}),
    serviceBucketApplicability: FieldToggle.default({}),
    priorActivity: FieldToggle.default({}),
    currentBalance: FieldToggle.default({}),
  })
  .default({});

const SectionToggle = z.object({
  enabled: z.boolean().default(true),
  title: z.string().optional(),
});

const Sections = z
  .object({
    planBasics: SectionToggle.default({}),
    serviceTier: SectionToggle.default({}),
    tierRules: SectionToggle.default({}),
    estimateBasis: SectionToggle.default({}),
    financialActivity: SectionToggle.default({}),
    finalCheck: SectionToggle.default({}),
  })
  .default({});

const StatusOption = z.object({
  id: Slug,
  label: NonEmpty,
});

const AssistanceType = z.object({
  id: Slug,
  label: NonEmpty,
  defaultCountsTowardOop: z.boolean().default(false),
  defaultCountsTowardDeductible: z.boolean().default(false),
});

const ChecklistItem = z.object({
  id: Slug,
  label: NonEmpty,
  required: z.boolean().default(true),
});

const Behavior = z
  .object({
    idleClearMinutes: z.number().int().min(0).default(15),
    showPrintButton: z.boolean().default(true),
    showCopyButton: z.boolean().default(true),
    draftAutosave: z.boolean().default(false),
  })
  .default({});

export const FacilityConfig = z.object({
  configVersion: z.literal(1),
  tenantId: Slug,
  branding: Branding,
  vocabulary: Vocabulary,
  serviceTiers: z.array(ServiceTier).min(1),
  statusOptions: z.array(StatusOption).default([
    { id: "not_yet_seen", label: "Not yet seen" },
    { id: "in_care", label: "In care" },
    { id: "discharged", label: "Discharged" },
  ]),
  assistanceTypes: z.array(AssistanceType).default([]),
  fields: Fields,
  sections: Sections,
  finalCheck: z.array(ChecklistItem).default([]),
  behavior: Behavior,
});

export type FacilityConfig = z.infer<typeof FacilityConfig>;
export type ServiceTier = z.infer<typeof ServiceTier>;
export type StatusOption = z.infer<typeof StatusOption>;
export type AssistanceType = z.infer<typeof AssistanceType>;
export type ChecklistItem = z.infer<typeof ChecklistItem>;
export type FieldToggle = z.infer<typeof FieldToggle>;
export type Vocabulary = z.infer<typeof Vocabulary>;
export type Branding = z.infer<typeof Branding>;
