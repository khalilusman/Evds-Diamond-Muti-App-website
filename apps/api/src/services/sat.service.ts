interface CatalogParams {
  rpm: number
  thickness_t2: number
  feed_t1: number
  feed_t2: number
  life_t1: number
  life_t2: number
}

interface DiagnosisInput {
  symptom_code: string
  rpm_reported?: number | null
  feed_reported?: number | null
  thickness?: number | null
  catalog: CatalogParams
}

export interface DiagnosisResult {
  auto_diagnosis: string
  probable_cause: string
  recommended_fix: string
  prevention: string
}

type DeviationFlag = 'OVERSPEED' | 'UNDERSPEED' | 'AGGRESSIVE_FEED' | 'SLOW_FEED' | 'NONE'

function classifyRpm(reported: number, recommended: number): DeviationFlag {
  if (reported > recommended * 1.15) return 'OVERSPEED'
  if (reported < recommended * 0.85) return 'UNDERSPEED'
  return 'NONE'
}

function classifyFeed(reported: number, catalogFeed: number): DeviationFlag {
  if (reported > catalogFeed * 1.20) return 'AGGRESSIVE_FEED'
  if (reported < catalogFeed * 0.80) return 'SLOW_FEED'
  return 'NONE'
}

const DIAGNOSIS_RULES: Array<{
  symptoms: string[]
  rpmFlag?: DeviationFlag
  feedFlag?: DeviationFlag
  result: Omit<DiagnosisResult, 'auto_diagnosis'>
}> = [
  {
    symptoms: ['polishing'],
    rpmFlag: 'UNDERSPEED',
    result: {
      probable_cause: 'Disc glazed — bond too hard for material at this RPM',
      recommended_fix: 'Increase RPM to recommended range. Use dressing brick.',
      prevention: 'Always operate within recommended RPM range',
    },
  },
  {
    symptoms: ['chipping'],
    feedFlag: 'AGGRESSIVE_FEED',
    result: {
      probable_cause: 'Excessive feed rate causing impact chipping',
      recommended_fix: 'Reduce feed speed to recommended range',
      prevention: 'Never exceed recommended feed speed',
    },
  },
  {
    symptoms: ['overheating'],
    result: {
      probable_cause: 'Insufficient cooling or incorrect RPM',
      recommended_fix: 'Check water flow. Verify RPM is within range.',
      prevention: 'Always ensure adequate water cooling',
    },
  },
  {
    symptoms: ['oval_disc'],
    result: {
      probable_cause: 'Vibration — loose flange or unbalanced machine',
      recommended_fix: 'Check and tighten flange. Balance machine.',
      prevention: 'Regular machine maintenance checks',
    },
  },
  {
    symptoms: ['not_cutting'],
    feedFlag: 'SLOW_FEED',
    result: {
      probable_cause: 'Crown loaded/blocked — disc not self-sharpening',
      recommended_fix: 'Use dressing brick. Increase feed pressure slightly.',
      prevention: 'Maintain recommended feed speed',
    },
  },
  {
    symptoms: ['undercutting'],
    result: {
      probable_cause: 'Abrasive material opening bond too fast',
      recommended_fix: 'Reduce feed speed. Check bond hardness vs material.',
      prevention: 'Match disc bond to material hardness',
    },
  },
  {
    symptoms: ['excessive_wear'],
    result: {
      probable_cause: 'Operating parameters outside recommended range',
      recommended_fix: 'Review all parameters against EVDS catalog',
      prevention: 'Regular parameter checks',
    },
  },
]

const DEFAULT_RESULT: Omit<DiagnosisResult, 'auto_diagnosis'> = {
  probable_cause: 'Parameter deviation detected',
  recommended_fix: 'Review operating parameters against catalog recommendations',
  prevention: 'Monitor RPM and feed speed regularly',
}

export function runDiagnosis(input: DiagnosisInput): DiagnosisResult {
  const { symptom_code, rpm_reported, feed_reported, catalog } = input
  const thickness = input.thickness ?? 2.0
  const useT2 = Math.abs(Number(catalog.thickness_t2) - thickness) < 0.01

  const rpmFlag = rpm_reported ? classifyRpm(rpm_reported, catalog.rpm) : 'NONE'
  const catalogFeed = useT2 ? catalog.feed_t2 : catalog.feed_t1
  const feedFlag = feed_reported ? classifyFeed(feed_reported, catalogFeed) : 'NONE'

  const flags: string[] = []
  if (rpmFlag !== 'NONE') flags.push(rpmFlag)
  if (feedFlag !== 'NONE') flags.push(feedFlag)

  const deviations: string[] = []
  if (rpm_reported) deviations.push(`RPM reported: ${rpm_reported} (recommended: ${catalog.rpm}) → ${rpmFlag === 'NONE' ? 'OK' : rpmFlag}`)
  if (feed_reported) deviations.push(`Feed reported: ${feed_reported} (catalog: ${catalogFeed}) → ${feedFlag === 'NONE' ? 'OK' : feedFlag}`)

  const autoDiagnosis = deviations.length > 0 ? deviations.join('. ') : 'No parameter deviation detected.'

  // Find matching rule
  const matched = DIAGNOSIS_RULES.find((rule) => {
    const symptomMatch = rule.symptoms.includes(symptom_code)
    const rpmMatch = rule.rpmFlag === undefined || rule.rpmFlag === rpmFlag
    const feedMatch = rule.feedFlag === undefined || rule.feedFlag === feedFlag
    return symptomMatch && rpmMatch && feedMatch
  })

  // Fall back to any rule matching symptom only
  const fallback = matched ?? DIAGNOSIS_RULES.find((rule) => rule.symptoms.includes(symptom_code))
  const result = fallback?.result ?? DEFAULT_RESULT

  return { auto_diagnosis: autoDiagnosis, ...result }
}
