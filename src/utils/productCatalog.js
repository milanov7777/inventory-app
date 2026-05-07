// Canonical product catalog — single source of truth for all SKUs.
// Add new SKUs here as products are introduced.
// Categories: P=Peptide, H=BAC Water, R=Research-use chemical, C=Capsule, L=Liquid, NS=Nasal Spray.

export const PRODUCT_CATALOG = [
  // Peptides
  { sku: 'P-001', name: 'BPC 5MG', category: 'Peptide' },
  { sku: 'P-002', name: 'BPC 10MG', category: 'Peptide' },
  { sku: 'P-003', name: 'TB-500 5MG', category: 'Peptide' },
  { sku: 'P-004', name: 'BPC/TB 5MG', category: 'Peptide' },
  { sku: 'P-005', name: 'GLOW 70MG', category: 'Peptide' },
  { sku: 'P-006', name: 'KLOW 80MG', category: 'Peptide' },
  { sku: 'P-007', name: 'GHKCU 50MG', category: 'Peptide' },
  { sku: 'P-008', name: 'MOTS 10MG', category: 'Peptide' },
  { sku: 'P-009', name: 'MOTS 40MG', category: 'Peptide' },
  { sku: 'P-010', name: 'HCG 5000', category: 'Peptide' },
  { sku: 'P-011', name: 'GLP-1SM 10MG', category: 'Peptide' },
  { sku: 'P-012', name: 'GLP-2TZ 10MG', category: 'Peptide' },
  { sku: 'P-013', name: 'GLP-2TZ 20MG', category: 'Peptide' },
  { sku: 'P-014', name: 'GLP-3RT 5MG', category: 'Peptide' },
  { sku: 'P-015', name: 'GLP-3RT 10MG', category: 'Peptide' },
  { sku: 'P-016', name: 'GLP-3RT 20MG', category: 'Peptide' },
  { sku: 'P-017', name: 'GLP-3RT 40MG', category: 'Peptide' },
  { sku: 'P-018', name: 'TESA 5MG', category: 'Peptide' },
  { sku: 'P-019', name: 'TESA 10MG', category: 'Peptide' },
  { sku: 'P-020', name: 'SERMORELIN 5MG', category: 'Peptide' },
  { sku: 'P-021', name: 'MELANOTAN 10MG', category: 'Peptide' },
  { sku: 'P-022', name: 'CJC/IPA 5MG', category: 'Peptide' },
  { sku: 'P-023', name: 'AOD-9604 5MG', category: 'Peptide' },
  { sku: 'P-024', name: 'DSIP 5MG', category: 'Peptide' },
  { sku: 'P-025', name: 'PT-141 10MG', category: 'Peptide' },
  { sku: 'P-026', name: 'NAD+ 500MG', category: 'Peptide' },
  { sku: 'P-027', name: 'GLP-3RT 50MG', category: 'Peptide' },
  { sku: 'P-028', name: 'GLUTITHIONE 600MG', category: 'Peptide' },
  { sku: 'P-029', name: 'KISSPEPTIN 10MG', category: 'Peptide' },
  { sku: 'P-030', name: 'IGF-1 LR3 1MG', category: 'Peptide' },
  { sku: 'P-031', name: 'KPV 10MG', category: 'Peptide' },
  { sku: 'P-032', name: 'SS-31 10MG', category: 'Peptide' },
  { sku: 'P-033', name: 'SEMAX 10MG', category: 'Peptide' },
  { sku: 'P-034', name: 'SELANK 10MG', category: 'Peptide' },
  { sku: 'P-035', name: 'GHKCU 100MG', category: 'Peptide' },
  { sku: 'P-036', name: 'TB-500 10MG', category: 'Peptide' },
  { sku: 'P-037', name: 'BPC/TB 10MG', category: 'Peptide' },
  { sku: 'P-038', name: 'TESA 20MG', category: 'Peptide' },
  { sku: 'P-039', name: 'GLP-2 TZ 30MG', category: 'Peptide' },

  // BAC Water
  { sku: 'H-30', name: 'BAC Water 30ML', category: 'BAC Water' },

  // Research chemicals
  { sku: 'R-003', name: 'Acetic Acid 10ML', category: 'Research' },

  // Capsules
  { sku: 'C-001', name: 'ENCLOMIPHINE 12.5MG', category: 'Capsule' },
  { sku: 'C-002', name: 'BPC-157 500MCG', category: 'Capsule' },
  { sku: 'C-003', name: 'SLU-PP-332 1MG', category: 'Capsule' },
  { sku: 'C-004', name: '5-AMINO 50MG', category: 'Capsule' },
  { sku: 'C-005', name: 'KPV 500 MCG', category: 'Capsule' },

  // Liquids
  { sku: 'L-001', name: 'Enclomiphione 12.5mg/ml', category: 'Liquid' },
  { sku: 'L-002', name: 'Minoxidil 10% 100mg/ml', category: 'Liquid' },
  { sku: 'L-003', name: 'RU/MINOX 5%/10% BLEND', category: 'Liquid' },
  { sku: 'L-004', name: 'Amino-Tadalafil 20mg/ml', category: 'Liquid' },

  // Nasal Sprays
  { sku: 'NS-001', name: 'NAD+', category: 'Nasal Spray' },
  { sku: 'NS-002', name: 'SEMAX', category: 'Nasal Spray' },
  { sku: 'NS-003', name: 'SELANK', category: 'Nasal Spray' },
  { sku: 'NS-004', name: 'PT-141', category: 'Nasal Spray' },
  { sku: 'NS-005', name: 'DREAM', category: 'Nasal Spray' },
  { sku: 'NS-006', name: 'NOOPEPT', category: 'Nasal Spray' },
  { sku: 'NS-007', name: 'MELANOTAN 2', category: 'Nasal Spray' },
]

// Quick lookup map: SKU → catalog entry
export const PRODUCT_BY_SKU = PRODUCT_CATALOG.reduce((map, p) => {
  map[p.sku.toUpperCase()] = p
  return map
}, {})

// All categories, in display order
export const PRODUCT_CATEGORIES = ['Peptide', 'Capsule', 'Liquid', 'Nasal Spray', 'BAC Water', 'Research']

// Look up a product's canonical name by SKU. Returns the SKU string itself if not found.
export function getProductName(sku) {
  if (!sku) return ''
  const p = PRODUCT_BY_SKU[String(sku).toUpperCase()]
  return p ? p.name : ''
}

// Look up a product's category. Returns 'Other' if not found.
export function getProductCategory(sku) {
  if (!sku) return 'Other'
  const p = PRODUCT_BY_SKU[String(sku).toUpperCase()]
  return p ? p.category : 'Other'
}
