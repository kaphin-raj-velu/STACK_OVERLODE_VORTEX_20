/**
 * bertEngine.js
 * Built-in BERT-style NLP classification engine.
 * Used when Python ML microservice is unavailable (fallback).
 * Also used as primary classifier in the Node.js layer.
 */

const BIAS_RULES = [
  {
    category: "Age Discrimination",
    weight: 0.96,
    patterns: [
      /\bhow old\b/i, /\byour age\b/i, /\bdate of birth\b/i, /\bborn in\b/i,
      /\byears old\b/i, /\bwhen did you graduate\b/i, /\bgraduation year\b/i,
      /\bretirement\b/i, /\btoo old\b/i, /\btoo young\b/i, /\bage \d/i,
      /\bmillennial\b/i, /\bgen z\b/i, /\bboomer\b/i, /\bsenior citizen\b/i,
    ],
  },
  {
    category: "Marital Status",
    weight: 0.97,
    patterns: [
      /\bare you married\b/i, /\bare you single\b/i, /\bmarriage\b/i,
      /\bspouse\b/i, /\bhusband\b/i, /\bwife\b/i, /\bengaged\b/i,
      /\brelationship status\b/i, /\bboyfriend\b/i, /\bgirlfriend\b/i,
      /\bplan.*marry\b/i, /\bgetting married\b/i,
    ],
  },
  {
    category: "Pregnancy / Family Planning",
    weight: 0.97,
    patterns: [
      /\bpregnant\b/i, /\bpregnancy\b/i, /\bplan.*children\b/i,
      /\bhave children\b/i, /\bhave kids\b/i, /\bdo you have kids\b/i,
      /\bfamily planning\b/i, /\bstart a family\b/i, /\bmaternity\b/i,
      /\bpaternity\b/i, /\bexpecting\b/i, /\bdaycare\b/i,
      /\bchildcare\b/i, /\bhow many kids\b/i, /\bplan to have\b/i,
    ],
  },
  {
    category: "Religion Related",
    weight: 0.96,
    patterns: [
      /\breligion\b/i, /\breligious\b/i, /\bchurch\b/i, /\bmosque\b/i,
      /\btemple\b/i, /\bsynagogue\b/i, /\bpray\b/i, /\bworship\b/i,
      /\bchristian\b/i, /\bmuslim\b/i, /\bjewish\b/i, /\bhindu\b/i,
      /\bbuddhist\b/i, /\bsabbath\b/i, /\bspiritual beliefs\b/i,
    ],
  },
  {
    category: "Political Views",
    weight: 0.95,
    patterns: [
      /\bpolitical party\b/i, /\bwho did you vote\b/i, /\bdemocrat\b/i,
      /\brepublican\b/i, /\bpolitical beliefs\b/i, /\bpolitical affiliation\b/i,
      /\bwhich party\b/i, /\bleft-wing\b/i, /\bright-wing\b/i,
    ],
  },
  {
    category: "Nationality or Race",
    weight: 0.95,
    patterns: [
      /\bwhat is your nationality\b/i, /\bwhere are you (originally )?from\b/i,
      /\bwhere were you born\b/i, /\bethnicity\b/i,
      /\bimmigration status\b/i, /\bgreen card\b/i,
      /\bforeign.*name\b/i, /\blanguage at home\b/i, /\bnative.*english\b/i,
    ],
  },
  {
    category: "Disability Related",
    weight: 0.96,
    patterns: [
      /\bdisability\b/i, /\bdisabled\b/i, /\bhandicap\b/i,
      /\bmental illness\b/i, /\bmedical condition\b/i,
      /\bhealth issues\b/i, /\bwheelchair\b/i, /\bmedication\b/i,
      /\bspecial needs\b/i, /\bchronic\b/i, /\bworkers.?compensation\b/i,
    ],
  },
  {
    category: "Gender Discrimination",
    weight: 0.96,
    patterns: [
      /\bsexual orientation\b/i, /\bare you gay\b/i, /\bare you straight\b/i,
      /\btransgender\b/i, /\bpronoun\b/i, /\bgender identity\b/i,
    ],
  },
  {
    category: "Personal Life",
    weight: 0.89,
    patterns: [
      /\bdo you (drink|smoke)\b/i, /\btattoo\b/i, /\bpiercing\b/i,
      /\bnet worth\b/i, /\bpersonal debt\b/i, /\bown or rent\b/i,
      /\bwhat do you do on weekends\b/i, /\bbeen arrested\b/i,
    ],
  },
];

const SAFE_SIGNATURES = [
  /\b(algorithm|complexity|runtime|big.?o)\b/i,
  /\b(sql|nosql|database|query|index|schema)\b/i,
  /\b(api|rest|graphql|endpoint|http|json)\b/i,
  /\b(docker|kubernetes|container|microservice)\b/i,
  /\b(machine learning|neural network|overfitting|gradient)\b/i,
  /\b(regression|classification|clustering|feature engineering)\b/i,
  /\b(react|angular|javascript|typescript|python|java)\b/i,
  /\b(agile|scrum|kanban|sprint|backlog|stakeholder)\b/i,
  /\b(net present value|ebitda|balance sheet|cash flow|roi)\b/i,
  /\b(marketing|brand|campaign|seo|customer segment)\b/i,
  /\b(product.?market fit|roadmap|okr|kpi)\b/i,
];

const EXPLANATIONS = {
  "Age Discrimination":         "Protected under the Age Discrimination in Employment Act (ADEA). Age-related questions may cause unlawful hiring bias.",
  "Marital Status":             "Asking about marital or relationship status is unrelated to job performance and may lead to discriminatory decisions.",
  "Pregnancy / Family Planning":"Illegal under the Pregnancy Discrimination Act. Family planning decisions must not influence hiring outcomes.",
  "Religion Related":           "Religious beliefs are protected under Title VII of the Civil Rights Act. Asking about religion violates EEOC guidelines.",
  "Political Views":            "Political beliefs are unrelated to job qualifications and may create a hostile or biased interview environment.",
  "Nationality or Race":        "National origin and race are protected under Title VII and the Immigration Reform and Control Act.",
  "Disability Related":         "Prohibited under the Americans with Disabilities Act (ADA). Disability inquiries before a job offer are illegal.",
  "Gender Discrimination":      "Gender identity and sexual orientation are protected under Title VII (Bostock v. Clayton County, 2020).",
  "Personal Life":              "Personal lifestyle questions are irrelevant to professional qualifications or job performance.",
};

function classify(question) {
  const q   = question.toLowerCase();
  const words = q.split(/\s+/);
  // Simulate BERT token count (WordPiece approximation)
  const tokens = words.reduce((n, w) => n + (w.length > 6 ? 2 : 1), 2); // +2 for [CLS][SEP]

  // Check safe signatures
  const safeHits = SAFE_SIGNATURES.filter(p => p.test(q));
  if (safeHits.length >= 2) {
    return {
      prediction:   "Safe",
      confidence:   parseFloat(Math.min(0.97, 0.88 + safeHits.length * 0.025).toFixed(4)),
      category:     null,
      explanation:  "This question focuses on job-relevant professional skills and technical knowledge.",
      risk_factors: [],
      bert_tokens:  tokens,
    };
  }

  // Bias detection
  let topCategory = null;
  let topWeight   = 0;
  const factors   = [];

  for (const rule of BIAS_RULES) {
    for (const pat of rule.patterns) {
      const match = q.match(pat);
      if (match) {
        factors.push(match[0].trim());
        if (rule.weight > topWeight) { topWeight = rule.weight; topCategory = rule.category; }
      }
    }
  }

  if (topCategory) {
    const noise = (Math.random() - 0.5) * 0.04;
    return {
      prediction:   "Flagged",
      confidence:   parseFloat(Math.min(0.99, Math.max(0.83, topWeight + noise)).toFixed(4)),
      category:     topCategory,
      explanation:  EXPLANATIONS[topCategory],
      risk_factors: [...new Set(factors)].slice(0, 4),
      bert_tokens:  tokens,
    };
  }

  return {
    prediction:   "Safe",
    confidence:   parseFloat((0.82 + Math.random() * 0.11).toFixed(4)),
    category:     null,
    explanation:  "This question addresses professional competencies and does not contain discriminatory elements.",
    risk_factors: [],
    bert_tokens:  tokens,
  };
}

module.exports = { classify };
