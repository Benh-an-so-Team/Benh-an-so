package com.benhsoan.domain.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.benhsoan.domain.prescription.MaxDailyDoseCalculator.Item;

class MaxDailyDoseCalculatorTest {

    private static Item item(
            String ingredient,
            String strengthValueMg,
            String singleDoseQuantity,
            int frequency,
            String maxDailyDoseMg) {
        return new Item(
                ingredient,
                strengthValueMg == null ? null : new BigDecimal(strengthValueMg),
                singleDoseQuantity == null ? null : new BigDecimal(singleDoseQuantity),
                frequency,
                maxDailyDoseMg == null ? null : new BigDecimal(maxDailyDoseMg));
    }

    @Test
    void exceedsMaxDailyDose_emitsWarning() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(
                List.of(item("Paracetamol", "500", "2", 3, "2000")));

        assertEquals(1, result.warnings().size());
        assertTrue(result.missingData().isEmpty());
        assertEquals("Paracetamol", result.warnings().getFirst().activeIngredient());
        assertEquals(0, new BigDecimal("3000").compareTo(result.warnings().getFirst().totalDailyDoseMg()));
        assertEquals(0, new BigDecimal("2000").compareTo(result.warnings().getFirst().maxDailyDoseMg()));
    }

    @Test
    void withinMaxDailyDose_emitsNoWarning() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(
                List.of(item("Paracetamol", "500", "1", 3, "2000")));

        assertTrue(result.warnings().isEmpty());
        assertTrue(result.missingData().isEmpty());
    }

    @Test
    void exactlyAtMaxDailyDose_emitsNoWarning() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(
                List.of(item("Paracetamol", "500", "1", 4, "2000")));

        assertTrue(result.warnings().isEmpty());
    }

    @Test
    void aggregatesMultipleItemsOfSameIngredient() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(List.of(
                item("Paracetamol", "500", "2", 2, "2500"),
                item("Paracetamol", "500", "1", 2, "2500")));

        assertEquals(1, result.warnings().size());
        assertEquals(0, new BigDecimal("3000").compareTo(result.warnings().getFirst().totalDailyDoseMg()));
    }

    @Test
    void aggregatesAcrossDifferentMedicineRowsSharingIngredientIgnoringCase() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(List.of(
                item("paracetamol", "500", "1", 3, "2000"),
                item("Paracetamol", "500", "1", 3, "2000")));

        assertEquals(1, result.warnings().size());
        assertEquals(0, new BigDecimal("3000").compareTo(result.warnings().getFirst().totalDailyDoseMg()));
    }

    @Test
    void differentIngredientsAreCheckedIndependently() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(List.of(
                item("Paracetamol", "500", "4", 3, "2000"),
                item("Ibuprofen", "200", "1", 2, "1200")));

        assertEquals(1, result.warnings().size());
        assertEquals("Paracetamol", result.warnings().getFirst().activeIngredient());
    }

    @Test
    void missingMaxDailyDose_isMissingDataNotBlocking() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(
                List.of(item("Paracetamol", "500", "2", 3, null)));

        assertTrue(result.warnings().isEmpty());
        assertEquals(1, result.missingData().size());
        assertEquals("Paracetamol", result.missingData().getFirst().activeIngredient());
    }

    @Test
    void mixedNullAndNonNullMaxDailyDose_isMissingData() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(List.of(
                item("Paracetamol", "500", "1", 1, "2000"),
                item("Paracetamol", "500", "1", 1, null)));

        assertTrue(result.warnings().isEmpty());
        assertEquals(1, result.missingData().size());
    }

    @Test
    void conflictingNonNullMaxDailyDose_isMissingData() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(List.of(
                item("Paracetamol", "500", "1", 1, "2000"),
                item("Paracetamol", "500", "1", 1, "4000")));

        assertTrue(result.warnings().isEmpty());
        assertEquals(1, result.missingData().size());
    }

    @Test
    void missingStrengthValueMg_isMissingDataNoPartialTotal() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(
                List.of(item("Paracetamol", null, "2", 3, "2000")));

        assertTrue(result.warnings().isEmpty());
        assertEquals(1, result.missingData().size());
    }

    @Test
    void missingSingleDoseQuantity_isMissingDataNoDefault() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(
                List.of(item("Paracetamol", "500", null, 3, "2000")));

        assertTrue(result.warnings().isEmpty());
        assertEquals(1, result.missingData().size());
    }

    @Test
    void nonPositiveFrequency_isMissingData() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(
                List.of(item("Paracetamol", "500", "2", 0, "2000")));

        assertTrue(result.warnings().isEmpty());
        assertEquals(1, result.missingData().size());
    }

    @Test
    void emptyInput_returnsEmptyResult() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(List.of());

        assertTrue(result.warnings().isEmpty());
        assertTrue(result.missingData().isEmpty());
    }

    @Test
    void sameNumericMaxDoseDifferentScale_isNotConflict() {
        // 2000.000 and 2000 are numerically equal and must not be treated as a
        // conflict.
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(List.of(
                item("Paracetamol", "500", "1", 1, "2000.000"),
                item("Paracetamol", "500", "1", 1, "2000")));

        assertTrue(result.missingData().isEmpty());
        assertTrue(result.warnings().isEmpty());
    }

    @Test
    void sameNumericMaxDoseTrailingZeros_isNotConflict() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(List.of(
                item("Paracetamol", "500", "1", 1, "2000.0"),
                item("Paracetamol", "500", "1", 1, "2000.00")));

        assertTrue(result.missingData().isEmpty());
    }

    @Test
    void differentNumericMaxDose_isConflict() {
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(List.of(
                item("Paracetamol", "500", "1", 1, "2000.000"),
                item("Paracetamol", "500", "1", 1, "2000.001")));

        assertEquals(1, result.missingData().size());
    }

    @Test
    void maxDoseScaleVariantStillTriggersWarning() {
        // medicine A max = 2000.000, medicine B max = 2000 (same numeric max),
        // daily total = 2500 → must emit a warning, not missing data.
        MaxDailyDoseEvaluationResult result = MaxDailyDoseCalculator.evaluate(List.of(
                item("Paracetamol", "500", "2", 2, "2000.000"),
                item("Paracetamol", "500", "1", 1, "2000")));

        assertTrue(result.missingData().isEmpty());
        assertEquals(1, result.warnings().size());
        assertEquals("Paracetamol", result.warnings().getFirst().activeIngredient());
        assertEquals(0, new BigDecimal("2500").compareTo(result.warnings().getFirst().totalDailyDoseMg()));
        assertEquals(0, new BigDecimal("2000").compareTo(result.warnings().getFirst().maxDailyDoseMg()));
    }
}
