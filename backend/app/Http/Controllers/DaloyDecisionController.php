<?php

namespace App\Http\Controllers;

use App\Models\WaterEconomyBarangay;
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

            'history.*.role' =>
                'required_with:history|string|in:user,assistant',

            'history.*.text' =>
                'required_with:history|string|max:1500',
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

        /*
        |--------------------------------------------------------------------------
        | SELECTED BARANGAY CONTEXT
        |--------------------------------------------------------------------------
        */

        $selectedContext = null;

        if (!empty($validated['psgc_code'])) {
            $barangay = WaterEconomyBarangay::where(
                'psgc_code',
                $validated['psgc_code']
            )->firstOrFail();

            $selectedContext = $contextService->build(
                $barangay,
                $calculator,
                $valuationService,
                $benefitService
            );
        }

        $workflowResults = null;
        if (!empty($validated['workflow_context']) && !empty($validated['psgc_code'])) {
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
                $savedProjects = \App\Models\WaterEconomyProject::where('psgc_code', $validated['psgc_code'])->get();
                $draftProjects = collect($validated['workflow_context']['projects'] ?? [])->map(
                    fn (array $project) => new \App\Models\WaterEconomyProject([...$project, 'psgc_code' => $validated['psgc_code']])
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

        if (!$selectedContext) {
            $rows = WaterEconomyBarangay::query()->get();

            $states = [];

            foreach ($rows as $row) {
                try {
                    $state = $calculator->calculate($row);

                    $states[] = [
                        'psgc_code' =>
                            $row->psgc_code,

                        'lgu' =>
                            $row->lgu,

                        'barangay' =>
                            $row->barangay,

                        'usable_water_m3_day' =>
                            data_get(
                                $state,
                                'water.usable_water_m3_day'
                            ),

                        'total_demand_m3_day' =>
                            data_get(
                                $state,
                                'water.total_demand_m3_day'
                            ),

                        'deficit_m3_day' =>
                            data_get(
                                $state,
                                'water.deficit_m3_day'
                            ),

                        'source_pressure_pct' =>
                            data_get(
                                $state,
                                'water.source_pressure_pct'
                            ),

                        'nrw_rate_pct' =>
                            data_get(
                                $state,
                                'water.nrw_rate_pct'
                            ),

                        'affordability_class' =>
                            data_get(
                                $state,
                                'affordability.affordability_class'
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

            $generalContext = [
                'pilot_area_barangay_count' =>
                    count($states),

                'lowest_usable_supply' =>
                    $this->rankBy(
                        $states,
                        'usable_water_m3_day',
                        true
                    ),

                'highest_deficit' =>
                    $this->rankBy(
                        $states,
                        'deficit_m3_day',
                        false
                    ),

                'highest_source_pressure' =>
                    $this->rankBy(
                        $states,
                        'source_pressure_pct',
                        false
                    ),

                'highest_nrw' =>
                    $this->rankBy(
                        $states,
                        'nrw_rate_pct',
                        false
                    ),

                'highest_total_demand' =>
                    $this->rankBy(
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

3. Use the supplied structured context.

4. Never claim that a suggested scenario has already been applied.

5. Your internal jobs are:
- Explain
- Compare
- Suggest
- Warn

Do not display those four job names as interface categories unless naturally needed in the answer.

GENERAL CONTEXT RULE:
If no barangay is selected, use GENERAL CONTEXT to answer questions about the pilot area.

Examples:
- barangay with lowest usable water
- highest deficit
- highest NRW
- highest source pressure
- highest demand

Do NOT tell the user to select a barangay when GENERAL CONTEXT already contains enough information.

NO. 23 — RECOMMENDATION FORMAT

Whenever the question involves a recommendation, comparison, risk, intervention, or next action, structure the answer conceptually as:

Suggested option
Why
Trade-off
Next test

Keep it compact.

Return JSON whenever possible using:

{
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

        foreach ($validated['history'] ?? [] as $history) {
            $messages[] = [
                'role' =>
                    $history['role'],

                'content' =>
                    $history['text'],
            ];
        }

        $structuredContext = [
            'outage_simulation_active' =>
                (bool) (
                    $validated['outage']
                    ?? false
                ),

            'selected_context' =>
                $selectedContext,

            'general_context' =>
                $generalContext,

            'workflow_results' => $workflowResults,
        ];

        $messages[] = [
            'role' => 'user',

            'content' =>
                "STRUCTURED CONTEXT:\n" .
                json_encode(
                    $structuredContext,
                    JSON_UNESCAPED_UNICODE |
                    JSON_UNESCAPED_SLASHES
                ) .
                "\n\nUSER QUESTION:\n" .
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
                        'model' =>
                            'openai/gpt-oss-20b',

                        'messages' =>
                            $messages,

                        'temperature' =>
                            0.05,

                        'max_completion_tokens' =>
                            1000,
                    ]
                );
        } catch (\Throwable $error) {
            return response()->json([
                'message' =>
                    'Unable to connect to DALOY AI.',

                'details' =>
                    $error->getMessage(),
            ], 500);
        }

        /*
        |--------------------------------------------------------------------------
        | GROQ ERROR
        |--------------------------------------------------------------------------
        */

        if ($response->failed()) {
            return response()->json([
                'message' =>
                    'DALOY AI request failed.',

                'status' =>
                    $response->status(),

                'details' =>
                    $response->json()
                    ?? $response->body(),
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
                'message' =>
                    'DALOY AI returned an empty response.',
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

        if (!is_array($decoded)) {
    return response()->json([
        'reply' =>
            $this->extractReadableReply($content),

        'recommendation' => [
            'suggested_option' => null,
            'why' => [],
            'tradeoff' => null,
            'next_test' => null,
        ],

        'suggested_scenario' => null,

        'context_type' =>
            $selectedContext
                ? 'barangay'
                : 'general',
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
            'reply' =>
                $reply,

            'recommendation' => [
                'suggested_option' =>
                    $decoded['suggested_option']
                    ?? null,

                'why' =>
                    is_array(
                        $decoded['why']
                        ?? null
                    )
                        ? array_slice(
                            $decoded['why'],
                            0,
                            3
                        )
                        : [],

                'tradeoff' =>
                    $decoded['tradeoff']
                    ?? null,

                'next_test' =>
                    $decoded['next_test']
                    ?? null,
            ],

            'suggested_scenario' =>
                $suggestion,

            'context_type' =>
                $selectedContext
                    ? 'barangay'
                    : 'general',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | GENERAL CONTEXT RANKING
    |--------------------------------------------------------------------------
    */

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
        if (!is_array($suggestion)) {
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
            ($suggestion['changes'] ?? [])
            as $key => $value
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
            'label' =>
                $label,

            'changes' =>
                $changes,
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

        if (!empty(
            $decoded['suggested_option']
        )) {
            $parts[] =
                'Suggested option: ' .
                $decoded['suggested_option'];
        }

        if (
            !empty($decoded['why']) &&
            is_array(
                $decoded['why']
            )
        ) {
            $parts[] =
                'Why: ' .
                implode(
                    '; ',
                    array_slice(
                        $decoded['why'],
                        0,
                        3
                    )
                );
        }

        if (!empty(
            $decoded['tradeoff']
        )) {
            $parts[] =
                'Trade-off: ' .
                $decoded['tradeoff'];
        }

        if (!empty(
            $decoded['next_test']
        )) {
            $parts[] =
                'Next test: ' .
                $decoded['next_test'];
        }

        if (count($parts) === 0) {
            return 'DALOY AI analyzed the available calculated context, but no concise recommendation was returned.';
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
