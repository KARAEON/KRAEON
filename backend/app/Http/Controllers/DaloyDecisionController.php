<?php

namespace App\Http\Controllers;

use App\Models\WaterEconomyBarangay;
use App\Models\WaterEconomyProject;
use App\Services\DaloyDecisionContextService;
use App\Services\InterventionValuationService;
use App\Services\PublicBenefitPerPesoService;
use App\Services\WaterEconomyCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class DaloyDecisionController extends Controller
{
    public function chat(
        Request $request,
        DaloyDecisionContextService $contextService,
        WaterEconomyCalculator $calculator,
        InterventionValuationService $valuationService,
        PublicBenefitPerPesoService $benefitService
    ) {
        $validated = $request->validate([
            'message' => 'required|string|max:2000',

            'psgc_code' => 'nullable|string|max:30',

            'outage' => 'sometimes|boolean',

            'history' => 'sometimes|array|max:8',

            'history.*.role' => 'required_with:history|string|in:user,assistant',

            'history.*.text' => 'required_with:history|string|max:1500',
            'workflow_context' => 'nullable|array',
            'workflow_context.changes' => 'required_with:workflow_context|array|min:1',
            'workflow_context.changes.nrw_rate_pct' => 'sometimes|numeric|min:0|max:100',
            'workflow_context.changes.gross_supply_m3_day' => 'sometimes|numeric|min:0',
            'workflow_context.changes.source_capacity_m3_day' => 'sometimes|numeric|min:0',
            'workflow_context.projects' => 'sometimes|array|max:12',
            'workflow_context.projects.*.project_type' => 'required|string|max:80',
            'workflow_context.projects.*.name' => 'required|string|max:160',
            'workflow_context.projects.*.capex_php' => 'required|numeric|min:0',
            'workflow_context.projects.*.annual_opex_php' => 'required|numeric|min:0',
            'workflow_context.projects.*.useful_life_years' => 'required|integer|min:1|max:100',
            'workflow_context.projects.*.water_gain_m3_per_day' => 'required|numeric|min:0',
            'workflow_context.projects.*.households_benefited' => 'required|integer|min:0',
            'workflow_context.projects.*.reliability_score' => 'required|numeric|min:0|max:100',
            'workflow_context.projects.*.equity_score' => 'required|numeric|min:0|max:100',
            'workflow_context.projects.*.economic_benefit_score' => 'required|numeric|min:0|max:100',
            'workflow_context.projects.*.implementation_time_months' => 'required|integer|min:1|max:600',
        ]);

        $conversationReply = $this->conversationReply($validated['message']);
        if ($conversationReply !== null && empty($validated['workflow_context'])) {
            return response()->json([
                'reply' => $conversationReply,
                'recommendation' => null,
                'suggested_scenario' => null,
                'context_type' => empty($validated['psgc_code']) ? 'general' : 'barangay',
            ]);
        }

        /*
        |--------------------------------------------------------------------------
        | SELECTED BARANGAY CONTEXT
        |--------------------------------------------------------------------------
        */

        $selectedContext = null;

        if (! empty($validated['psgc_code'])) {
            $barangay = WaterEconomyBarangay::where(
                'psgc_code',
                $validated['psgc_code']
            )->first();

            if ($barangay === null) {
                return response()->json([
                    'reply' => 'I do not have a record for that barangay in the available project data. Try another barangay or ask a general question about water or watersheds.',
                    'answer_status' => 'missing_data',
                    'recommendation' => null,
                    'suggested_scenario' => null,
                    'context_type' => 'general',
                ]);
            }

            $selectedContext = $contextService->build(
                $barangay,
                $calculator,
                $valuationService,
                $benefitService
            );
        }

        $workflowResults = null;
        if (! empty($validated['workflow_context']) && ! empty($validated['psgc_code'])) {
            $barangay ??= WaterEconomyBarangay::where('psgc_code', $validated['psgc_code'])->firstOrFail();
            $draft = $barangay->replicate();
            $draft->exists = true;
            $draft->setAttribute('id', $barangay->id);
            foreach ($validated['workflow_context']['changes'] as $key => $value) {
                $draft->setAttribute($key, $value);
            }
            $workflowResults = [
                'scenario' => [
                    'before' => $calculator->calculate($barangay),
                    'after' => $calculator->calculate($draft),
                    'changes' => $validated['workflow_context']['changes'],
                    'saved' => false,
                ],
            ];
            if (array_key_exists('projects', $validated['workflow_context'])) {
                $savedProjects = WaterEconomyProject::where('psgc_code', $validated['psgc_code'])->get();
                $draftProjects = collect($validated['workflow_context']['projects'] ?? [])->map(
                    fn (array $project) => new WaterEconomyProject([...$project, 'psgc_code' => $validated['psgc_code']])
                );
                $workflowResults['intervention_ranking'] = $benefitService->rank(
                    $savedProjects->concat($draftProjects), $valuationService
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | GENERAL PILOT-AREA CONTEXT
        |--------------------------------------------------------------------------
        |
        | This keeps DALOY AI useful even when no barangay is selected.
        |
        */

        $generalContext = null;

        if (! $selectedContext) {
            $rows = WaterEconomyBarangay::query()->get();

            $states = [];

            foreach ($rows as $row) {
                try {
                    $state = $calculator->calculate($row);

                    $states[] = [
                        'psgc_code' => $row->psgc_code,

                        'lgu' => $row->lgu,

                        'barangay' => $row->barangay,

                        'usable_water_m3_day' => data_get(
                            $state,
                            'water.usable_water_m3_day'
                        ),

                        'total_demand_m3_day' => data_get(
                            $state,
                            'water.total_demand_m3_day'
                        ),

                        'deficit_m3_day' => data_get(
                            $state,
                            'water.deficit_m3_day'
                        ),

                        'source_pressure_pct' => data_get(
                            $state,
                            'water.source_pressure_pct'
                        ),

                        'nrw_rate_pct' => data_get(
                            $state,
                            'water.nrw_rate_pct'
                        ),

                        'affordability_class' => data_get(
                            $state,
                            'affordability.affordability_class'
                        ),

                        'current_tariff_php_m3' => data_get(
                            $state,
                            'affordability.current_tariff_php_m3'
                        ),

                        'proposed_tariff_php_m3' => data_get(
                            $state,
                            'affordability.proposed_tariff_php_m3'
                        ),

                        'monthly_consumption_m3' => data_get(
                            $state,
                            'affordability.monthly_consumption_m3'
                        ),

                        'avg_household_income_php' => data_get(
                            $state,
                            'affordability.avg_household_income_php'
                        ),

                        'low_income_monthly_income_php' => data_get(
                            $state,
                            'affordability.low_income_monthly_income_php'
                        ),

                        'low_affordability_threshold_pct' => data_get(
                            $state,
                            'affordability.policy_thresholds.low_below_pct'
                        ),

                        'current_water_burden_pct' => data_get(
                            $state,
                            'affordability.current_water_burden_pct'
                        ),

                        'low_income_water_burden_pct' => data_get(
                            $state,
                            'affordability.low_income_water_burden_pct'
                        ),
                    ];
                } catch (\Throwable $error) {
                    /*
                     * One incomplete row should not break
                     * the entire DALOY AI assistant.
                     */
                    continue;
                }
            }

            $tariffAffordabilityRows = array_values(array_filter(array_map(
                function (array $state): ?array {
                    $monthlyConsumption = (float) ($state['monthly_consumption_m3'] ?? 0);
                    $lowIncome = (float) ($state['low_income_monthly_income_php'] ?? 0);
                    $averageIncome = (float) ($state['avg_household_income_php'] ?? 0);
                    $threshold = (float) ($state['low_affordability_threshold_pct'] ?? 0);

                    if ($monthlyConsumption <= 0) {
                        return null;
                    }

                    return [
                        'lgu' => $state['lgu'],
                        'barangay' => $state['barangay'],
                        'current_tariff_php_m3' => $state['current_tariff_php_m3'],
                        'proposed_tariff_php_m3' => $state['proposed_tariff_php_m3'],
                        'current_water_burden_pct' => $state['current_water_burden_pct'],
                        'low_income_water_burden_pct' => $state['low_income_water_burden_pct'],
                        'configured_low_threshold_pct' => $threshold,
                        'average_household_tariff_at_low_threshold_php_m3' => $averageIncome > 0
                            ? round(($averageIncome * $threshold / 100) / $monthlyConsumption, 2)
                            : null,
                        'low_income_tariff_at_low_threshold_php_m3' => $lowIncome > 0
                            ? round(($lowIncome * $threshold / 100) / $monthlyConsumption, 2)
                            : null,
                    ];
                },
                $states
            ), fn (?array $row): bool => $row !== null));

            $lowIncomeAffordableTariffs = array_values(array_filter(
                array_column($tariffAffordabilityRows, 'low_income_tariff_at_low_threshold_php_m3'),
                fn ($value): bool => is_numeric($value)
            ));
            $currentTariffs = array_column($tariffAffordabilityRows, 'current_tariff_php_m3');
            $averageHouseholdTariffs = array_column($tariffAffordabilityRows, 'average_household_tariff_at_low_threshold_php_m3');
            $configuredThresholds = array_values(array_unique(array_column($tariffAffordabilityRows, 'configured_low_threshold_pct')));
            sort($configuredThresholds, SORT_NUMERIC);

            $generalContext = [
                'pilot_area_barangay_count' => count($states),

                'tariff_affordability' => [
                    'records_with_monthly_consumption' => count($tariffAffordabilityRows),
                    'current_tariff_median_php_m3' => $this->medianNumeric($currentTariffs),
                    'average_household_tariff_at_configured_low_threshold_median_php_m3' => $this->medianNumeric($averageHouseholdTariffs),
                    'low_income_tariff_at_configured_low_threshold_median_php_m3' => $this->medianNumeric($lowIncomeAffordableTariffs),
                    'configured_low_affordability_threshold_pct' => $configuredThresholds,
                    'lowest_low_income_tariff_at_configured_low_threshold_php_m3' => $lowIncomeAffordableTariffs[0] ?? null,
                    'highest_low_income_tariff_at_configured_low_threshold_php_m3' => $lowIncomeAffordableTariffs === []
                        ? null
                        : $lowIncomeAffordableTariffs[count($lowIncomeAffordableTariffs) - 1],
                    'most_affordable_barangays' => $this->rankBy(
                        $tariffAffordabilityRows,
                        'low_income_tariff_at_low_threshold_php_m3',
                        true
                    ),
                    'method' => 'Affordable tariff ceiling = low-income monthly income × configured low affordability threshold ÷ monthly water consumption. This is a calculated prototype benchmark, not a legally mandated tariff.',
                ],

                'lowest_usable_supply' => $this->rankBy(
                    $states,
                    'usable_water_m3_day',
                    true
                ),

                'highest_deficit' => $this->rankBy(
                    $states,
                    'deficit_m3_day',
                    false
                ),

                'highest_source_pressure' => $this->rankBy(
                    $states,
                    'source_pressure_pct',
                    false
                ),

                'highest_nrw' => $this->rankBy(
                    $states,
                    'nrw_rate_pct',
                    false
                ),

                'highest_total_demand' => $this->rankBy(
                    $states,
                    'total_demand_m3_day',
                    false
                ),
            ];
        }

        /*
        |--------------------------------------------------------------------------
        | DALOY AI SYSTEM INSTRUCTIONS
        |--------------------------------------------------------------------------
        */

        $system = <<<'PROMPT'
You are DALOY AI, the decision assistant inside the DALOY Water Decision System.

ARCHITECTURE:
User Inputs
→ Calculation Engines
→ Structured Results
→ DALOY AI
→ Explanation / Suggestions

NON-NEGOTIABLE RULES:

1. Calculations happen BEFORE AI.

2. Never invent, recalculate, change, or fabricate:
- water supply
- demand
- deficit
- NRW
- source pressure
- affordability
- project costs
- project rankings
- benefit scores
- alerts
- monetary values
- population counts and census years
- local watershed names, boundaries, areas, condition, and water-source connections

3. Use the supplied structured context.

POPULATION AND WATERSHEDS:
Use population_context for 2024 population questions about named barangays or LGUs,
even when another barangay is selected. Use selected_context.population for the selected barangay.
LGU recorded_population totals cover stored records only; do not call them complete official
LGU census totals. Preserve missing values as unavailable, not zero. Household estimates
are not population counts. Respect the supplied population data status.
You may explain general watershed concepts, runoff, recharge, erosion, water quality,
and how population growth can affect water demand and watershed management.
Clearly separate general explanations and possible risks from measured local conditions.
When watershed_context says local records are unavailable, say that the project has no
verified local watershed data for questions about names, boundaries, areas, condition,
or which watershed supplies a barangay. Do not infer a watershed from an LGU name,
source capacity, the map, or a simulated reservoir. Still answer conceptual questions directly.

4. Never claim that a suggested scenario has already been applied.

5. Your internal jobs are:
- Explain
- Compare
- Suggest
- Warn

Do not display those four job names as interface categories unless naturally needed in the answer.

CONVERSATION:
For unclear messages, ask one brief clarifying question and offer a relevant example.
If the available data cannot answer a question, state what is missing and what you can answer.
Do not invent facts or describe a missing answer as a connection failure.
Keep greetings and acknowledgements natural and brief.

MISSING DATA (applies to every topic, not just population or watersheds):
For a specific local fact, date, statistic, person, facility, or dataset field that the context
does not contain, return answer_status: "missing_data" and a normal conversational message.
Say "I don't have [the requested information] in the available project data" and offer a
related question you can answer. Do not fabricate a value, substitute a different statistic,
or suggest changing water inputs to obtain unrelated missing facts.
For a question outside DALOY's population and water decision-support scope, return
answer_status: "out_of_scope", briefly explain what you can help with, and ask a relevant question.
For general educational water or watershed questions, you can use general knowledge;
they do not require a database entry. Use answer_status: "answered".
For an ambiguous question, use answer_status: "clarification" and ask what the user means.
Missing data and out-of-scope questions are successful chat replies, not technical errors.

GENERAL CONTEXT RULE:
If no barangay is selected, use GENERAL CONTEXT to answer questions about the pilot area,
including its tariff_affordability summary.

Examples:
- barangay with lowest usable water
- highest deficit
- highest NRW
- highest source pressure
- highest demand

Do NOT tell the user to select a barangay when GENERAL CONTEXT already contains enough information.

TARIFF AFFORDABILITY:
Use the supplied tariff and affordability figures. With no barangay selected, use
general_context.tariff_affordability. With a barangay selected, use
selected_context.affordability. The context includes tariff ceilings calculated from
household income, monthly consumption, and the configured low affordability threshold.
Give the ceiling as a prototype benchmark, explain that one pilot-wide price cannot fit
every household, and use the low-income ceiling when discussing a price intended to
protect lower-income households. These thresholds are project settings, not universal
legal limits. Do not say tariff data is missing or ask for supply cost or demand when
these figures are present. Do not infer demand response from a tariff change.

NO. 23 — RECOMMENDATION FORMAT

Whenever the question involves a recommendation, comparison, risk, intervention, or next action, structure the answer conceptually as:

Suggested option
Why
Trade-off
Next test

Keep it compact.

Return one JSON object using the fields below. Always put the direct answer in "message",
including factual population questions. For factual or conceptual questions, use empty
recommendation fields and suggested_scenario: null. Never return the context itself as the answer.

{
  "answer_status": "answered | missing_data | out_of_scope | clarification",
  "suggested_option": "short option, result, or finding",
  "why": [
    "reason 1",
    "reason 2"
  ],
  "tradeoff": "short trade-off",
  "next_test": "one useful next test",
  "message": "compact natural-language answer",
  "suggested_scenario": null
}

NO. 24 — SAFE SUGGESTED SCENARIOS

You may propose a scenario only when:
- a barangay is selected;
- the current structured context supports the suggestion;
- the value is reasonable and clearly a proposed test.

A suggested scenario is NOT automatically applied.

Allowed keys:

nrw_rate_pct
gross_supply_m3_day
proposed_tariff_php_m3
demand_response_pct
household_allocated_m3_day
critical_services_allocated_m3_day
agriculture_allocated_m3_day
fisheries_allocated_m3_day
aquaculture_allocated_m3_day
business_allocated_m3_day
industry_allocated_m3_day

Suggested scenario format:

{
  "label": "short scenario name",
  "changes": {
    "nrw_rate_pct": 20
  }
}

Only numeric values are allowed.

If there is no defensible concrete scenario:

"suggested_scenario": null

DATA STATUS:
Respect ACTUAL, HISTORICAL, ESTIMATED, USER INPUT, SIMULATED, and PROJECTED labels.

STYLE:
- concise
- clear
- professional decision-support language
- no markdown tables
- avoid unnecessary introductions
- mention important trade-offs
- never present configurable thresholds as universal law
- do not repeatedly say "prototype"
PROMPT;

        /*
        |--------------------------------------------------------------------------
        | BUILD MESSAGES
        |--------------------------------------------------------------------------
        */

        $messages = [
            [
                'role' => 'system',
                'content' => $system,
            ],
        ];

        foreach (array_slice($validated['history'] ?? [], -4) as $history) {
            $messages[] = [
                'role' => $history['role'],

                'content' => mb_substr($history['text'], 0, 600),
            ];
        }

        $structuredContext = [
            'outage_simulation_active' => (bool) (
                $validated['outage']
                ?? false
            ),

            'selected_context' => $selectedContext,

            'general_context' => $generalContext,

            'workflow_results' => $workflowResults,

            'population_context' => $contextService->populationContext(
                implode(' ', array_column(array_slice($validated['history'] ?? [], -2), 'text')).' '.$validated['message'],
                $validated['psgc_code'] ?? null
            ),

            'watershed_context' => [
                'local_records_available' => false,
                'data_status' => 'No verified local watershed inventory, boundaries, or source connections are stored in this project.',
            ],
        ];

        $messages[] = [
            'role' => 'user',

            'content' => "STRUCTURED CONTEXT:\n".
                json_encode(
                    $structuredContext,
                    JSON_UNESCAPED_UNICODE |
                    JSON_UNESCAPED_SLASHES
                ).
                "\n\nUSER QUESTION:\n".
                $validated['message'],
        ];

        /*
        |--------------------------------------------------------------------------
        | GROQ REQUEST
        |--------------------------------------------------------------------------
        |
        | Keep this request simple for maximum compatibility.
        |
        */

        try {
            $response = Http::withToken(
                env('GROQ_API_KEY')
            )
                ->acceptJson()
                ->timeout(45)
                ->post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    [
                        'model' => 'openai/gpt-oss-20b',

                        'messages' => $messages,

                        'temperature' => 0.05,

                        'max_completion_tokens' => 1000,
                        'reasoning_effort' => 'low',
                        'include_reasoning' => false,
                        'response_format' => ['type' => 'json_object'],
                    ]
                );
        } catch (\Throwable $error) {
            return response()->json([
                'message' => 'The AI service is temporarily unavailable. Please try again shortly.',
            ], 503);
        }

        /*
        |--------------------------------------------------------------------------
        | GROQ ERROR
        |--------------------------------------------------------------------------
        */

        if ($response->failed()) {
            return response()->json([
                'message' => match ($response->status()) {
                    429 => 'The AI is busy right now. Please wait a moment and try again.',
                    413 => 'This request is too long for the AI. Please try a shorter question.',
                    default => 'The AI service is temporarily unavailable. Please try again shortly.',
                },
                'status' => $response->status(),
            ], $response->status());
        }

        /*
        |--------------------------------------------------------------------------
        | READ AI RESPONSE
        |--------------------------------------------------------------------------
        */

        $content = trim(
            (string) $response->json(
                'choices.0.message.content'
            )
        );

        if ($content === '') {
            return response()->json([
                'message' => 'The AI did not return an answer. Please try again or rephrase your question.',
            ], 502);
        }

        /*
        |--------------------------------------------------------------------------
        | TRY JSON FIRST
        |--------------------------------------------------------------------------
        */

        $decoded = $this->decodeAiJson(
            $content
        );

        /*
        |--------------------------------------------------------------------------
        | FALLBACK TO NORMAL TEXT
        |--------------------------------------------------------------------------
        |
        | If the model does not return valid JSON,
        | do NOT crash the chat.
        |
        */

        if (! is_array($decoded)) {
            return response()->json([
                'reply' => $this->extractReadableReply($content),

                'recommendation' => [
                    'suggested_option' => null,
                    'why' => [],
                    'tradeoff' => null,
                    'next_test' => null,
                ],

                'suggested_scenario' => null,

                'context_type' => $selectedContext
                        ? 'barangay'
                        : 'general',
            ]);
        }

        $answerStatus = $decoded['answer_status'] ?? 'answered';
        if (in_array($answerStatus, ['missing_data', 'out_of_scope', 'clarification'], true)) {
            $message = $decoded['message'] ?? null;
            $reply = is_string($message) ? trim($message) : '';
            if ($reply === '') {
                $reply = match ($answerStatus) {
                    'missing_data' => 'I do not have that information in the available project data. I can help with recorded population, water supply, or general watershed questions.',
                    'out_of_scope' => 'I can help with population and water-related questions. What would you like to know about those topics?',
                    default => 'Could you clarify your question? You can include the barangay or LGU name and what you want to know.',
                };
            }

            return response()->json([
                'reply' => $reply,
                'answer_status' => $answerStatus,
                'recommendation' => null,
                'suggested_scenario' => null,
                'context_type' => $selectedContext ? 'barangay' : 'general',
            ]);
        }

        /*
        |--------------------------------------------------------------------------
        | SAFE SCENARIO
        |--------------------------------------------------------------------------
        */

        $suggestion =
            $this->sanitizeSuggestion(
                $decoded['suggested_scenario']
                ?? null
            );

        /*
        |--------------------------------------------------------------------------
        | FINAL RESPONSE
        |--------------------------------------------------------------------------
        */

        $reply =
            trim(
                (string) (
                    $decoded['message']
                    ?? ''
                )
            );

        if ($reply === '') {
            $reply =
                $this->buildFallbackMessage(
                    $decoded
                );
        }

        return response()->json([
            'reply' => $reply,

            'recommendation' => [
                'suggested_option' => $decoded['suggested_option']
                    ?? null,

                'why' => is_array(
                    $decoded['why']
                    ?? null
                )
                        ? array_slice(
                            $decoded['why'],
                            0,
                            3
                        )
                        : [],

                'tradeoff' => $decoded['tradeoff']
                    ?? null,

                'next_test' => $decoded['next_test']
                    ?? null,
            ],

            'suggested_scenario' => $suggestion,

            'context_type' => $selectedContext
                    ? 'barangay'
                    : 'general',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | GENERAL CONTEXT RANKING
    |--------------------------------------------------------------------------
    */

    private function conversationReply(string $message): ?string
    {
        $normalized = preg_replace('/[.!?,]+$/u', '', mb_strtolower(trim($message)));

        return match ($normalized) {
            'k', 'ok', 'okay', 'okk', 'kk', 'alright' => 'Okay! Ask me about population, water supply, or watersheds whenever you are ready.',
            'hehe', 'hehehe', 'haha', 'hahaha', 'lol' => 'What would you like to know? You can ask about population, water supply, or watersheds.',
            'hi', 'hello', 'hey' => 'Hi! How can I help with population, water supply, or watersheds?',
            'thanks', 'thank you', 'ty' => 'You are welcome! Let me know if you have another question.',
            default => null,
        };
    }

    private function medianNumeric(array $values): ?float
    {
        $values = array_values(array_filter($values, fn ($value): bool => is_numeric($value)));
        sort($values, SORT_NUMERIC);

        if ($values === []) {
            return null;
        }

        $middleIndex = intdiv(count($values), 2);

        return count($values) % 2 === 1
            ? (float) $values[$middleIndex]
            : round(((float) $values[$middleIndex - 1] + (float) $values[$middleIndex]) / 2, 2);
    }

    private function rankBy(
        array $items,
        string $key,
        bool $ascending = false
    ): array {
        $filtered = array_values(
            array_filter(
                $items,
                function ($item) use ($key) {
                    return isset($item[$key])
                        && is_numeric(
                            $item[$key]
                        );
                }
            )
        );

        usort(
            $filtered,
            function (
                $a,
                $b
            ) use (
                $key,
                $ascending
            ) {
                $aValue =
                    (float) $a[$key];

                $bValue =
                    (float) $b[$key];

                return $ascending
                    ? $aValue <=> $bValue
                    : $bValue <=> $aValue;
            }
        );

        return array_slice(
            $filtered,
            0,
            5
        );
    }

    /*
    |--------------------------------------------------------------------------
    | AI JSON PARSER
    |--------------------------------------------------------------------------
    */

    private function decodeAiJson(
        string $content
    ): ?array {
        /*
         * First try normal JSON.
         */

        $decoded =
            json_decode(
                $content,
                true
            );

        if (is_array($decoded)) {
            return $decoded;
        }

        /*
         * Remove Markdown code fences.
         */

        $cleaned =
            preg_replace(
                '/^```(?:json)?\s*|\s*```$/i',
                '',
                trim($content)
            );

        $decoded =
            json_decode(
                $cleaned,
                true
            );

        if (is_array($decoded)) {
            return $decoded;
        }

        /*
         * Last attempt:
         * extract first JSON object.
         */

        $start =
            strpos(
                $cleaned,
                '{'
            );

        $end =
            strrpos(
                $cleaned,
                '}'
            );

        if (
            $start !== false &&
            $end !== false &&
            $end > $start
        ) {
            $json =
                substr(
                    $cleaned,
                    $start,
                    $end - $start + 1
                );

            $decoded =
                json_decode(
                    $json,
                    true
                );

            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    /*
    |--------------------------------------------------------------------------
    | SAFE AI SCENARIO
    |--------------------------------------------------------------------------
    */

    private function sanitizeSuggestion(
        mixed $suggestion
    ): ?array {
        if (! is_array($suggestion)) {
            return null;
        }

        $allowed = [
            'nrw_rate_pct',
            'gross_supply_m3_day',
            'proposed_tariff_php_m3',
            'demand_response_pct',

            'household_allocated_m3_day',
            'critical_services_allocated_m3_day',

            'agriculture_allocated_m3_day',
            'fisheries_allocated_m3_day',
            'aquaculture_allocated_m3_day',

            'business_allocated_m3_day',
            'industry_allocated_m3_day',
        ];

        $changes = [];

        foreach (
            ($suggestion['changes'] ?? []) as $key => $value
        ) {
            if (
                in_array(
                    $key,
                    $allowed,
                    true
                ) &&
                is_numeric($value)
            ) {
                $changes[$key] =
                    (float) $value;
            }
        }

        if (count($changes) === 0) {
            return null;
        }

        $label =
            trim(
                (string) (
                    $suggestion['label']
                    ?? 'Try Suggested Scenario'
                )
            );

        if ($label === '') {
            $label =
                'Try Suggested Scenario';
        }

        return [
            'label' => $label,

            'changes' => $changes,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | FALLBACK RECOMMENDATION TEXT
    |--------------------------------------------------------------------------
    */

    private function buildFallbackMessage(
        array $decoded
    ): string {
        $parts = [];

        if (! empty(
            $decoded['suggested_option']
        )) {
            $parts[] =
                'Suggested option: '.
                $decoded['suggested_option'];
        }

        if (
            ! empty($decoded['why']) &&
            is_array(
                $decoded['why']
            )
        ) {
            $parts[] =
                'Why: '.
                implode(
                    '; ',
                    array_slice(
                        $decoded['why'],
                        0,
                        3
                    )
                );
        }

        if (! empty(
            $decoded['tradeoff']
        )) {
            $parts[] =
                'Trade-off: '.
                $decoded['tradeoff'];
        }

        if (! empty(
            $decoded['next_test']
        )) {
            $parts[] =
                'Next test: '.
                $decoded['next_test'];
        }

        if (count($parts) === 0) {
            return 'I could not find a clear answer. Could you rephrase your question or include the barangay or LGU name?';
        }

        return implode(
            "\n",
            $parts
        );
    }

    private function extractReadableReply(
        string $content
    ): string {
        $content = trim($content);

        /*
         * Try to extract a JSON "message" field
         * even when the full JSON was malformed/truncated.
         */
        if (
            preg_match(
                '/"message"\s*:\s*"((?:\\\\.|[^"\\\\])*)"/s',
                $content,
                $matches
            )
        ) {
            $message =
                stripcslashes(
                    $matches[1]
                );

            return trim($message);
        }

        /*
         * Remove JSON/code-fence noise.
         */
        $cleaned =
            preg_replace(
                '/```(?:json)?|```/i',
                '',
                $content
            );

        $cleaned =
            preg_replace(
                '/^\s*[\{\[]+/',
                '',
                $cleaned
            );

        $cleaned =
            preg_replace(
                '/[\}\]]+\s*$/',
                '',
                $cleaned
            );

        $cleaned =
            preg_replace(
                '/"(suggested_option|why|tradeoff|next_test|suggested_scenario)"\s*:.*/s',
                '',
                $cleaned
            );

        $cleaned =
            preg_replace(
                '/^"?message"?\s*:\s*"?/i',
                '',
                trim($cleaned)
            );

        $cleaned =
            trim(
                $cleaned,
                " \n\r\t,\""
            );

        return $cleaned !== ''
            ? $cleaned
            : 'DALOY AI analyzed the available information but could not format the response correctly.';
    }
}
