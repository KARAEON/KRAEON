<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('water_economy_barangays', function (Blueprint $table) {
            $table->decimal('monthly_consumption_m3', 10, 2)
                ->default(15)
                ->after('tariff_php_m3');

            $table->decimal('proposed_tariff_php_m3', 10, 2)
                ->default(30)
                ->after('monthly_consumption_m3');

            $table->decimal('demand_response_pct', 7, 2)
                ->default(0)
                ->after('proposed_tariff_php_m3');

            $table->decimal('low_income_monthly_income_php', 14, 2)
                ->default(0)
                ->after('avg_household_income_php');

            // Configurable policy thresholds — these are NOT universal standards.
            $table->decimal('affordability_low_threshold_pct', 6, 2)
                ->default(3)
                ->after('low_income_monthly_income_php');

            $table->decimal('affordability_high_threshold_pct', 6, 2)
                ->default(5)
                ->after('affordability_low_threshold_pct');
        });
    }

    public function down(): void
    {
        Schema::table('water_economy_barangays', function (Blueprint $table) {
            $table->dropColumn([
                'monthly_consumption_m3',
                'proposed_tariff_php_m3',
                'demand_response_pct',
                'low_income_monthly_income_php',
                'affordability_low_threshold_pct',
                'affordability_high_threshold_pct',
            ]);
        });
    }
};
