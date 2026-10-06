<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('water_economy_barangays', function (Blueprint $table) {
            $table->id(); $table->string('psgc_code')->unique(); $table->string('lgu'); $table->string('barangay');
            $table->string('urban_rural')->nullable(); $table->unsignedInteger('population_2024')->default(0); $table->decimal('avg_household_size',5,2)->default(4.50);
            $table->decimal('gross_supply_m3_day',14,2)->default(0); $table->decimal('source_capacity_m3_day',14,2)->default(0);
            $table->decimal('nrw_rate_pct',6,2)->default(25); $table->decimal('reserve_rate_pct',6,2)->default(5); $table->decimal('tariff_php_m3',10,2)->default(30);
            $table->decimal('avg_household_income_php',14,2)->default(0); $table->decimal('monthly_water_cost_php',12,2)->default(0);
            $table->decimal('piped_access_pct',6,2)->default(0); $table->decimal('supply_reliability_pct',6,2)->default(0); $table->string('livelihood_profile')->nullable();
            foreach (['household','critical_services','agriculture','fisheries','aquaculture','business','industry'] as $s) {
                $table->decimal($s.'_demand_m3_day',14,2)->default(0); $table->decimal($s.'_allocated_m3_day',14,2)->default(0);
            }
            $table->json('sector_meta')->nullable(); $table->json('data_status')->nullable(); $table->unsignedBigInteger('data_version')->default(1); $table->timestamps();
            $table->index('lgu'); $table->index(['lgu','barangay']);
        });
    }
    public function down(): void { Schema::dropIfExists('water_economy_barangays'); }
};
