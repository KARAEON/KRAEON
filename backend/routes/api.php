<?php

use App\Http\Controllers\AiController;
use App\Http\Controllers\WaterEconomyController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\NRWScenarioController;
use App\Http\Controllers\WaterEconomyProjectController;
use App\Http\Controllers\InterventionValuationController;
use App\Http\Controllers\DecisionSnapshotController;
use App\Http\Controllers\PublicBenefitPerPesoController;
use App\Http\Controllers\DaloyDecisionController;
use App\Http\Controllers\ScenarioPreviewController;

Route::get(
    '/water-economy/barangays',
    [WaterEconomyController::class, 'index']
);

Route::get(
    '/water-economy/barangays/{psgcCode}',
    [WaterEconomyController::class, 'show']
);

Route::put(
    '/water-economy/barangays/{psgcCode}',
    [WaterEconomyController::class, 'update']
);

Route::get(
    '/water-economy/state/{psgcCode}',
    [WaterEconomyController::class, 'state']
);

Route::post(
    '/ai/chat',
    [AiController::class, 'chat']
);
Route::get(
    '/water-economy/nrw/{psgcCode}',
    [NRWScenarioController::class, 'show']
);

Route::put(
    '/water-economy/nrw/{psgcCode}',
    [NRWScenarioController::class, 'update']
);

Route::get(
    '/water-economy/projects/{psgcCode}',
    [WaterEconomyProjectController::class, 'index']
);

Route::post(
    '/water-economy/projects/{psgcCode}',
    [WaterEconomyProjectController::class, 'store']
);

Route::put(
    '/water-economy/projects/{psgcCode}/{project}',
    [WaterEconomyProjectController::class, 'update']
);

Route::delete(
    '/water-economy/projects/{psgcCode}/{project}',
    [WaterEconomyProjectController::class, 'destroy']
);
Route::get(
    '/water-economy/valuation/{psgcCode}',
    [InterventionValuationController::class, 'index']
);

Route::get(
    '/water-economy/valuation/{psgcCode}/{project}',
    [InterventionValuationController::class, 'show']
);

Route::get(
    '/water-economy/decision-snapshot/{psgcCode}',
    [DecisionSnapshotController::class, 'show']
);

Route::post(
    '/water-economy/decision-snapshot/{psgcCode}/ai',
    [DecisionSnapshotController::class, 'aiRewrite']
);

Route::get(
    '/water-economy/benefit-per-peso/{psgcCode}',
    [PublicBenefitPerPesoController::class, 'show']
);
Route::post(
    '/water-economy/benefit-per-peso/{psgcCode}/preview',
    [PublicBenefitPerPesoController::class, 'preview']
);

Route::post(
    '/ai/decision-chat',
    [DaloyDecisionController::class, 'chat']
);

Route::post(
    '/water-economy/scenario-preview/{psgcCode}',
    [ScenarioPreviewController::class, 'preview']
);
