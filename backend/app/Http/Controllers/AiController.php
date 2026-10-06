<?php

namespace App\Http\Controllers;

use App\Models\WaterEconomyBarangay;
use App\Services\WaterEconomyCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AiController extends Controller
{
    public function chat(
        Request $request,
        WaterEconomyCalculator $calculator
    ) {
        $request->validate([
            'message' => 'required|string|max:3000',
            'history' => 'nullable|array',
            'outage' => 'nullable|boolean',
            'psgc_code' => 'nullable|string|max:20',
        ]);

        $question = trim($request->input('message'));
        $questionLower = strtolower($question);

        /*
        |--------------------------------------------------------------------------
        | SELECTED BARANGAY
        |--------------------------------------------------------------------------
        */

        if ($request->filled('psgc_code')) {
            $barangay = WaterEconomyBarangay::where(
                'psgc_code',
                $request->input('psgc_code')
            )->first();

            if ($barangay) {
                $state = $calculator->calculate($barangay);

                $context = [
                    'scope' => 'selected_barangay',

                    'lgu' =>
                        $state['municipality'] ?? null,

                    'barangay' =>
                        $state['barangay'] ?? null,

                    'data_version' =>
                        $state['data_version'] ?? null,

                    'population' =>
                        $state['population'] ?? [],

                    'water' =>
                        $state['water'] ?? [],

                    'affordability' =>
                        $state['affordability'] ?? [],

                    'sector_demand' =>
                        $state['sector_demand_m3_day']
                        ?? [],

                    'sector_allocation' =>
                        $state['sector_allocation_m3_day']
                        ?? [],

                    'sector_satisfaction' =>
                        $state['sector_satisfaction_pct']
                        ?? [],

                    'alerts' =>
                        array_slice(
                            $state['alerts'] ?? [],
                            0,
                            5
                        ),
                ];

                return $this->askDaloy(
                    $question,
                    $context,
                    $request
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | GENERAL MODE
        |--------------------------------------------------------------------------
        |
        | Calculate all barangays locally, but send only the small amount
        | of information needed for the current question.
        |
        */

        $barangays = WaterEconomyBarangay::query()
            ->whereIn('lgu', [
                'Catbalogan City',
                'Pinabacdao',
                'Calbayog City',
            ])
            ->get();

        $states = collect();

        foreach ($barangays as $barangay) {
            $state = $calculator->calculate($barangay);

            $states->push([
                'lgu' =>
                    $barangay->lgu,

                'barangay' =>
                    $barangay->barangay,

                'population' =>
                    $state['population']
                        ['population_2024']
                    ?? 0,

                'gross_supply' =>
                    $state['water']
                        ['gross_supply_m3_day']
                    ?? 0,

                'usable_supply' =>
                    $state['water']
                        ['usable_water_m3_day']
                    ?? 0,

                'demand' =>
                    $state['water']
                        ['total_demand_m3_day']
                    ?? 0,

                'deficit' =>
                    $state['water']
                        ['deficit_m3_day']
                    ?? 0,

                'source_pressure' =>
                    $state['water']
                        ['source_pressure_pct']
                    ?? null,

                'nrw' =>
                    $state['water']
                        ['nrw_rate_pct']
                    ?? null,

                'reliability' =>
                    $state['water']
                        ['supply_reliability_pct']
                    ?? null,

                'water_burden' =>
                    $state['affordability']
                        ['water_burden_pct']
                    ?? null,
            ]);
        }

        /*
        |--------------------------------------------------------------------------
        | DETECT WHAT THE USER IS ASKING
        |--------------------------------------------------------------------------
        */

        $context = [
            'scope' =>
                'Catbalogan City, Pinabacdao, and Calbayog City',

            'total_barangays' =>
                $states->count(),
        ];

        /*
        |--------------------------------------------------------------------------
        | LOWEST SUPPLY
        |--------------------------------------------------------------------------
        */

        if (
            str_contains($questionLower, 'lowest') &&
            (
                str_contains($questionLower, 'supply') ||
                str_contains($questionLower, 'water')
            )
        ) {
            $context['analysis'] =
                'lowest usable water supply';

            $context['results'] = $states
                ->sortBy('usable_supply')
                ->take(5)
                ->values()
                ->all();
        }

        /*
        |--------------------------------------------------------------------------
        | HIGHEST SUPPLY
        |--------------------------------------------------------------------------
        */

        elseif (
            str_contains($questionLower, 'highest') &&
            (
                str_contains($questionLower, 'supply') ||
                str_contains($questionLower, 'water')
            )
        ) {
            $context['analysis'] =
                'highest usable water supply';

            $context['results'] = $states
                ->sortByDesc('usable_supply')
                ->take(5)
                ->values()
                ->all();
        }

        /*
        |--------------------------------------------------------------------------
        | DEFICIT
        |--------------------------------------------------------------------------
        */

        elseif (
            str_contains($questionLower, 'deficit') ||
            str_contains($questionLower, 'shortage')
        ) {
            $context['analysis'] =
                'highest water deficit';

            $context['results'] = $states
                ->sortByDesc('deficit')
                ->take(5)
                ->values()
                ->all();
        }

        /*
        |--------------------------------------------------------------------------
        | NRW
        |--------------------------------------------------------------------------
        */

        elseif (
            str_contains($questionLower, 'nrw') ||
            str_contains(
                $questionLower,
                'non-revenue'
            )
        ) {
            $context['analysis'] =
                'highest NRW';

            $context['results'] = $states
                ->filter(
                    fn ($row) =>
                        $row['nrw'] !== null
                )
                ->sortByDesc('nrw')
                ->take(5)
                ->values()
                ->all();
        }

        /*
        |--------------------------------------------------------------------------
        | SOURCE PRESSURE
        |--------------------------------------------------------------------------
        */

        elseif (
            str_contains(
                $questionLower,
                'source pressure'
            ) ||
            str_contains(
                $questionLower,
                'pressure'
            )
        ) {
            $context['analysis'] =
                'highest source pressure';

            $context['results'] = $states
                ->filter(
                    fn ($row) =>
                        $row['source_pressure']
                        !== null
                )
                ->sortByDesc('source_pressure')
                ->take(5)
                ->values()
                ->all();
        }

        /*
        |--------------------------------------------------------------------------
        | RELIABILITY
        |--------------------------------------------------------------------------
        */

        elseif (
            str_contains(
                $questionLower,
                'reliability'
            ) ||
            str_contains(
                $questionLower,
                'reliable'
            )
        ) {
            $context['analysis'] =
                'lowest supply reliability';

            $context['results'] = $states
                ->sortBy('reliability')
                ->take(5)
                ->values()
                ->all();
        }

        /*
        |--------------------------------------------------------------------------
        | AFFORDABILITY / WATER BURDEN
        |--------------------------------------------------------------------------
        */

        elseif (
            str_contains(
                $questionLower,
                'affordability'
            ) ||
            str_contains(
                $questionLower,
                'water burden'
            ) ||
            str_contains(
                $questionLower,
                'expensive'
            )
        ) {
            $context['analysis'] =
                'highest household water burden';

            $context['results'] = $states
                ->filter(
                    fn ($row) =>
                        $row['water_burden']
                        !== null
                )
                ->sortByDesc('water_burden')
                ->take(5)
                ->values()
                ->all();
        }

        /*
        |--------------------------------------------------------------------------
        | GENERAL QUESTION
        |--------------------------------------------------------------------------
        */

        else {
            $lguSummary = $states
                ->groupBy('lgu')
                ->map(
                    function ($rows, $lgu) {
                        return [
                            'lgu' => $lgu,

                            'barangays' =>
                                $rows->count(),

                            'population' =>
                                $rows->sum(
                                    'population'
                                ),

                            'usable_supply_m3_day' =>
                                round(
                                    $rows->sum(
                                        'usable_supply'
                                    ),
                                    2
                                ),

                            'demand_m3_day' =>
                                round(
                                    $rows->sum(
                                        'demand'
                                    ),
                                    2
                                ),

                            'deficit_m3_day' =>
                                round(
                                    $rows->sum(
                                        'deficit'
                                    ),
                                    2
                                ),
                        ];
                    }
                )
                ->values()
                ->all();

            $context['analysis'] =
                'general LGU water economy';

            $context['lgu_summary'] =
                $lguSummary;
        }

        return $this->askDaloy(
            $question,
            $context,
            $request
        );
    }

    /*
    |--------------------------------------------------------------------------
    | SEND SMALL STRUCTURED CONTEXT TO GROQ
    |--------------------------------------------------------------------------
    */

    private function askDaloy(
        string $question,
        array $context,
        Request $request
    ) {
        $systemPrompt = <<<'PROMPT'
You are DULOY AI, the AI decision assistant for the DULOY Water Decision System in Samar, Philippines.

Pilot LGUs:
Catbalogan City
Pinabacdao
Calbayog City

The Laravel calculation engine performs calculations and rankings before you receive them.

Never invent or replace those calculations.

Use only the CURRENT STRUCTURED CONTEXT for numeric claims.

If the context includes ranked results, the first result is the current highest or lowest result requested by the analysis.

Do not tell the user to select a barangay when the supplied context already answers the question.

Some database values are simulated prototype inputs and are not official government statistics.
Some database values may be simulated, estimated, user-entered, historical, projected, or source-backed.

Do not repeatedly mention these labels in normal answers.

Only mention uncertainty or data status when it is important to avoid misleading the user.

For ordinary comparison and ranking questions, answer directly using the current configured system data.

When relevant, say:
"based on the current prototype data"
or
"using the current configured values."

Your jobs:
Explain results.
Compare alternatives.
Suggest scenarios to test.
Warn about trade-offs or disadvantaged users.

Use water-economics reasoning:
scarcity,
allocation,
affordability,
equity,
livelihood,
food security,
reliability,
economic efficiency,
and public benefit.

Never claim you changed system values.
You may only recommend a scenario for the user to test.

Answer directly in one short paragraph.
Usually 1 to 2 sentences.
Maximum 3 sentences.
No bullet lists.
No tables.
No headings.

CURRENT STRUCTURED CONTEXT:
PROMPT;

        /*
        | Compact JSON.
        | DO NOT use JSON_PRETTY_PRINT.
        */

        $systemPrompt .= json_encode(
            $context,
            JSON_UNESCAPED_UNICODE |
            JSON_UNESCAPED_SLASHES
        );

        $messages = [
            [
                'role' => 'system',
                'content' => $systemPrompt,
            ],
        ];

        /*
        | Keep only last 2 conversation messages.
        */

        $history = array_slice(
            $request->input('history', []),
            -2
        );

        foreach ($history as $item) {
            if (
                isset(
                    $item['role'],
                    $item['text']
                ) &&
                in_array(
                    $item['role'],
                    ['user', 'assistant'],
                    true
                )
            ) {
                $messages[] = [
                    'role' =>
                        $item['role'],

                    'content' =>
                        mb_substr(
                            $item['text'],
                            0,
                            600
                        ),
                ];
            }
        }

        $messages[] = [
            'role' => 'user',
            'content' => mb_substr(
                $question,
                0,
                1500
            ),
        ];

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
                        300,

                    'reasoning_effort' =>
                        'low',

                    'include_reasoning' =>
                        false,
                ]
            );

        if ($response->failed()) {
            return response()->json([
                'message' =>
                    'AI request failed.',

                'status' =>
                    $response->status(),

                'details' =>
                    $response->body(),
            ], $response->status());
        }

        $reply = trim(
            (string) $response->json(
                'choices.0.message.content'
            )
        );

        if ($reply === '') {
            return response()->json([
                'message' =>
                    'DULOY AI returned an empty response.',
            ], 500);
        }

        return response()->json([
            'reply' => $reply,

            'context_type' =>
                $context['scope']
                    ?? 'general',

            'context_version' =>
                $context['data_version']
                    ?? null,
        ]);
    }
}