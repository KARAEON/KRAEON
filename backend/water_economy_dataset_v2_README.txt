WATER ECONOMY DATASET V2

Scope: Catbalogan City (57 barangays), Pinabacdao (24), Calbayog City (157) = 238 barangays.

REAL / SOURCE-BACKED FIELDS:
- Barangay name and PSGC code
- Urban/rural classification
- 2024 population
- LGU 2020 average household size

DERIVED PROTOTYPE FIELDS:
- 2024 estimated households = 2024 population / 2020 LGU average household size
- Basic domestic demand = population x 55 L/person/day
- Gross production requirement = net demand / 0.85 (15% NRW assumption)

SIMULATED FIELDS:
- Household income, water cost, water burden, access, reliability, livelihood,
  shortage risk, outage economic loss, intervention priority.

DEVELOPMENT ASSET BANK:
- Includes 16 asset types. DPWH-backed defaults are used where a suitable
  Green Building baseline exists; otherwise the template requires a custom/local coefficient.
- Shopping-mall component coefficients supplied by the user are included as editable prototype defaults.

IMPORTANT: Derived and simulated values must not be presented as official barangay statistics.
