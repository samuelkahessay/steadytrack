/**
 * Unit Completion Verification
 *
 * Legacy system for unit completion gating based on microcards and resources.
 * Currently disabled (UNIT_COMPLETION_GATING_ENABLED = false) for local-first architecture.
 */

// Global switch to disable unit completion gating entirely.
// When false, students can freely mark units complete without
// requiring microcard quizzes or resource completion.
const UNIT_COMPLETION_GATING_ENABLED = false;

export interface UnitCompletionStatus {
  canComplete: boolean;
  reason: string | undefined;
  cardsStatus: {
    total: number;
    passed: number;
    required: boolean;
  };
  resourcesStatus: {
    total: number;
    completed: number;
  };
}

/**
 * Check if a unit meets the requirements for completion
 *
 * Requirements:
 * - All resources must be marked complete
 * - At least one microcard must have a passing quiz result (if cards exist)
 * - Grace mode: Units without microcards can be completed with just resources
 */
export async function checkUnitCompletionRequirements(params: {
  unitId: string;
  subject: string;
  outcomeCodes?: string[];
  resourceUrls: string[];
  completedResourceUrls: Set<string>;
}): Promise<UnitCompletionStatus> {
  const { subject: _subject, outcomeCodes = [], resourceUrls, completedResourceUrls } = params;

  // Check resources completion
  const totalResources = resourceUrls.length;
  const completedResources = resourceUrls.filter(url => completedResourceUrls.has(url)).length;
  const allResourcesComplete = totalResources === 0 || completedResources === totalResources;

  // If gating is disabled, always allow completion
  if (!UNIT_COMPLETION_GATING_ENABLED) {
    return {
      canComplete: true,
      reason: undefined,
      cardsStatus: {
        total: 0,
        passed: 0,
        required: false,
      },
      resourcesStatus: {
        total: totalResources,
        completed: completedResources,
      },
    };
  }

  // If no outcome codes, can complete with resources only (grace mode)
  if (outcomeCodes.length === 0) {
    return {
      canComplete: allResourcesComplete,
      reason: allResourcesComplete ? undefined : `Complete all ${totalResources} resources to unlock this unit`,
      cardsStatus: {
        total: 0,
        passed: 0,
        required: false
      },
      resourcesStatus: {
        total: totalResources,
        completed: completedResources
      }
    };
  }

  // Microcards are no longer fetched (gating disabled)
  const microcards: Array<{ id: string; outcome_code: string }> = [];

  const totalCards = microcards?.length || 0;

  // Grace mode: If no microcards exist for this unit, allow completion with resources only
  if (totalCards === 0) {
    return {
      canComplete: allResourcesComplete,
      reason: allResourcesComplete ? undefined : `Complete all ${totalResources} resources to unlock this unit`,
      cardsStatus: {
        total: 0,
        passed: 0,
        required: false
      },
      resourcesStatus: {
        total: totalResources,
        completed: completedResources
      }
    };
  }

  // Auth disabled - no user check
  const user = null;
  if (!user) {
    // Guest mode: degrade gracefully to resources-only requirement.
    // We can't verify quick-check results without auth, so allow unit
    // completion based on resource completion alone and avoid alarming text.
    return {
      canComplete: allResourcesComplete,
      reason: allResourcesComplete
        ? undefined
        : `Complete all ${totalResources} resources to unlock this unit`,
      cardsStatus: {
        total: 0,
        passed: 0,
        required: false,
      },
      resourcesStatus: {
        total: totalResources,
        completed: completedResources,
      },
    };
  }

  const _microcardIds = microcards?.map(m => m.id) || [];

  // Quick check results no longer fetched (gating disabled)
  const quizResults: Array<{ microcard_id: string; correct: boolean; created_at: string }> = [];

  // Count unique cards with passing results (latest attempt)
  const passedCardIds = new Set<string>();
  const seenCardIds = new Set<string>();

  for (const result of quizResults || []) {
    if (seenCardIds.has(result.microcard_id)) continue; // Skip older attempts
    seenCardIds.add(result.microcard_id);

    if (result.correct) {
      passedCardIds.add(result.microcard_id);
    }
  }

  const passedCards = passedCardIds.size;
  const allCardsPassed = passedCards >= totalCards;

  // Both resources AND cards must be complete
  const canComplete = allResourcesComplete && allCardsPassed;

  let reason: string | undefined;
  if (!canComplete) {
    const missing: string[] = [];
    if (!allResourcesComplete) {
      missing.push(`${totalResources - completedResources} resource${totalResources - completedResources > 1 ? 's' : ''}`);
    }
    if (!allCardsPassed) {
      missing.push(`${totalCards - passedCards} learning card${totalCards - passedCards > 1 ? 's' : ''}`);
    }
    reason = `Complete ${missing.join(' and ')} to unlock this unit`;
  }

  return {
    canComplete,
    reason,
    cardsStatus: {
      total: totalCards,
      passed: passedCards,
      required: true
    },
    resourcesStatus: {
      total: totalResources,
      completed: completedResources
    }
  };
}

/**
 * Batch check completion requirements for multiple units
 * More efficient than checking one at a time
 */
export async function batchCheckUnitCompletionRequirements(
  units: Array<{
    unitId: string;
    subject: string;
    outcomeCodes?: string[];
    resourceUrls: string[];
  }>,
  completedResourceUrls: Set<string>
): Promise<Map<string, UnitCompletionStatus>> {
  const statusMap = new Map<string, UnitCompletionStatus>();

  // If gating is disabled, all units can complete freely
  if (!UNIT_COMPLETION_GATING_ENABLED) {
    for (const unit of units) {
      const totalResources = unit.resourceUrls.length;
      const completedResources = unit.resourceUrls.filter(url => completedResourceUrls.has(url)).length;
      statusMap.set(unit.unitId, {
        canComplete: true,
        reason: undefined,
        cardsStatus: { total: 0, passed: 0, required: false },
        resourcesStatus: { total: totalResources, completed: completedResources },
      });
    }
    return statusMap;
  }

  // Collect all outcome codes and subjects
  const allOutcomeCodes = new Set<string>();
  const subjectToOutcomes = new Map<string, Set<string>>();

  for (const unit of units) {
    if (unit.outcomeCodes && unit.outcomeCodes.length > 0) {
      unit.outcomeCodes.forEach(code => {
        allOutcomeCodes.add(code);
        if (!subjectToOutcomes.has(unit.subject)) {
          subjectToOutcomes.set(unit.subject, new Set());
        }
        subjectToOutcomes.get(unit.subject)!.add(code);
      });
    }
  }

  // Fetch all microcards in one query
  const subjects = Array.from(subjectToOutcomes.keys());
  const outcomeCodes = Array.from(allOutcomeCodes);

  if (subjects.length === 0 || outcomeCodes.length === 0) {
    // No cards to check - all units use grace mode
    for (const unit of units) {
      const totalResources = unit.resourceUrls.length;
      const completedResources = unit.resourceUrls.filter(url => completedResourceUrls.has(url)).length;
      const allResourcesComplete = totalResources === 0 || completedResources === totalResources;

      statusMap.set(unit.unitId, {
        canComplete: allResourcesComplete,
        reason: allResourcesComplete ? undefined : `Complete all ${totalResources} resources to unlock this unit`,
        cardsStatus: {
          total: 0,
          passed: 0,
          required: false
        },
        resourcesStatus: {
          total: totalResources,
          completed: completedResources
        }
      });
    }
    return statusMap;
  }

  // Microcards no longer fetched (gating disabled)
  const microcards: Array<{ id: string; subject: string; outcome_code: string }> = [];

  // Auth disabled - no user check
  const user = null;
  if (!user) {
    // Return empty status for all units if not authenticated
    for (const unit of units) {
      statusMap.set(unit.unitId, {
        canComplete: false,
        reason: 'Authentication required',
        cardsStatus: { total: 0, passed: 0, required: false },
        resourcesStatus: { total: 0, completed: 0 }
      });
    }
    return statusMap;
  }

  const _microcardIds2 = microcards?.map(m => m.id) || [];

  // Quick check results no longer fetched (gating disabled)
  const quizResults: Array<{ microcard_id: string; correct: boolean; created_at: string }> = [];

  // Build microcard map
  const outcomeToCards = new Map<string, string[]>();
  for (const card of microcards || []) {
    const key = `${card.subject}::${card.outcome_code}`;
    if (!outcomeToCards.has(key)) {
      outcomeToCards.set(key, []);
    }
    outcomeToCards.get(key)!.push(card.id);
  }

  // Build passed cards set
  const passedCardIds = new Set<string>();
  const seenCardIds = new Set<string>();

  for (const result of quizResults || []) {
    if (seenCardIds.has(result.microcard_id)) continue;
    seenCardIds.add(result.microcard_id);

    if (result.correct) {
      passedCardIds.add(result.microcard_id);
    }
  }

  // Check each unit
  for (const unit of units) {
    const totalResources = unit.resourceUrls.length;
    const completedResources = unit.resourceUrls.filter(url => completedResourceUrls.has(url)).length;
    const allResourcesComplete = totalResources === 0 || completedResources === totalResources;

    // Get cards for this unit
    const unitCardIds = new Set<string>();
    for (const outcomeCode of unit.outcomeCodes || []) {
      const key = `${unit.subject}::${outcomeCode}`;
      const cards = outcomeToCards.get(key) || [];
      cards.forEach(id => unitCardIds.add(id));
    }

    const totalCards = unitCardIds.size;

    // Grace mode: no cards for this unit
    if (totalCards === 0) {
      statusMap.set(unit.unitId, {
        canComplete: allResourcesComplete,
        reason: allResourcesComplete ? undefined : `Complete all ${totalResources} resources to unlock this unit`,
        cardsStatus: {
          total: 0,
          passed: 0,
          required: false
        },
        resourcesStatus: {
          total: totalResources,
          completed: completedResources
        }
      });
      continue;
    }

    // Count passed cards
    const passedCount = Array.from(unitCardIds).filter(id => passedCardIds.has(id)).length;
    const allCardsPassed = passedCount >= totalCards;

    const canComplete = allResourcesComplete && allCardsPassed;

    let reason: string | undefined;
    if (!canComplete) {
      const missing: string[] = [];
      if (!allResourcesComplete) {
        missing.push(`${totalResources - completedResources} resource${totalResources - completedResources > 1 ? 's' : ''}`);
      }
      if (!allCardsPassed) {
        missing.push(`${totalCards - passedCount} learning card${totalCards - passedCount > 1 ? 's' : ''}`);
      }
      reason = `Complete ${missing.join(' and ')} to unlock this unit`;
    }

    statusMap.set(unit.unitId, {
      canComplete,
      reason,
      cardsStatus: {
        total: totalCards,
        passed: passedCount,
        required: true
      },
      resourcesStatus: {
        total: totalResources,
        completed: completedResources
      }
    });
  }

  return statusMap;
}
