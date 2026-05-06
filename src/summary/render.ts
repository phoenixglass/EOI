import type { FacilityConfig } from "../config/schema";
import type { FormState } from "../state/formState";
import { computeFinancials } from "../calc/calculations";
import { renderTemplate } from "./template";

export interface SummaryOutput {
  staff: string;
  patient: string;
  generatedAt: string;
}

function findById<T extends { id: string; label: string }>(
  list: T[],
  id: string,
): { id: string; label: string } | null {
  if (!id) return null;
  const found = list.find((x) => x.id === id);
  return found ? { id: found.id, label: found.label } : null;
}

export function buildContext(
  config: FacilityConfig,
  state: FormState,
): Record<string, unknown> {
  const f = computeFinancials(state);
  const generatedAt = new Date().toLocaleString(
    config.vocabulary.currency.locale,
  );

  const tier = (id: string) => findById(config.serviceTiers, id);

  const activities = state.activities.map((a) => {
    const tierLabel = tier(a.tierId)?.label ?? "";
    const aType = config.assistanceTypes.find(
      (t) => t.id === a.assistanceTypeId,
    );
    return {
      tierLabel,
      clientPayment: a.clientPayment ?? 0,
      assistance: a.assistance ?? 0,
      assistanceType: aType?.label ?? "",
      countsTowardOop: a.countsTowardOop,
      countsTowardDeductible: a.countsTowardDeductible,
      notes: a.notes,
    };
  });

  return {
    facility: config.branding,
    t: config.vocabulary,
    form: {
      network: state.network,
      deductibleTotal: state.deductibleTotal,
      deductibleMet: state.deductibleMet,
      deductibleRemaining: f.deductibleRemaining,
      oopMaxTotal: state.oopMaxTotal,
      oopMet: state.oopMet,
      oopRemaining: f.oopRemaining,
      deductibleOopStructure: state.deductibleOopStructure,
      patientStatus: findById(config.statusOptions, state.patientStatusId),
      currentTier: tier(state.currentTierId),
      verifiedTier: tier(state.verifiedTierId),
      deductibleApplies: state.deductibleApplies,
      coinsurancePercent: state.coinsurancePercent,
      copayAmount: state.copayAmount,
      activities,
      totalPaymentsToOop: f.totalPaymentsToOop,
      totalAssistanceToOop: f.totalAssistanceToOop,
      totalEpisodeActivityToOop: f.totalEpisodeActivityToOop,
      oopSatisfied: f.oopSatisfied,
      crossTierWarning: f.crossTierWarning,
      currentBalance: state.currentBalance,
    },
    generatedAt,
  };
}

export function renderSummaries(
  config: FacilityConfig,
  state: FormState,
): SummaryOutput {
  const ctx = buildContext(config, state);
  const renderCtx = {
    locale: config.vocabulary.currency.locale,
    currencyCode: config.vocabulary.currency.code,
  };
  return {
    staff: renderTemplate(config.templates.staffSummary, ctx, renderCtx),
    patient: renderTemplate(
      config.templates.patientExplanation,
      ctx,
      renderCtx,
    ),
    generatedAt: ctx.generatedAt as string,
  };
}
