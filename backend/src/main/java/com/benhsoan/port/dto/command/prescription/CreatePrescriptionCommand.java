package com.benhsoan.port.dto.command.prescription;

import java.util.List;
import java.util.UUID;

import lombok.Builder;

@Builder
public record CreatePrescriptionCommand(

        UUID medicalRecordId,

        String note,

        List<CreatePrescriptionItemCommand> items,

        List<PrescriptionInteractionOverrideCommand> interactionOverrides,

        List<PrescriptionAllergyOverrideCommand> allergyOverrides,

        List<PrescriptionContraindicationOverrideCommand> contraindicationOverrides,

        List<PrescriptionMaxDailyDoseOverrideCommand> maxDailyDoseOverrides,

        boolean controlledMedicineConfirmed,

        PrescriptionCreationContext creationContext

) {

    public CreatePrescriptionCommand {
        creationContext = creationContext == null
                ? PrescriptionCreationContext.STANDARD
                : creationContext;
    }
}
