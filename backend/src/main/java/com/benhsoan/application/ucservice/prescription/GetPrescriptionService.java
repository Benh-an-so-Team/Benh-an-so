package com.benhsoan.application.ucservice.prescription;

import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.result.PrescriptionResult;
import com.benhsoan.port.inbound.prescription.GetPrescriptionByCodeUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionUseCase;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionWarningLogRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetPrescriptionService implements GetPrescriptionUseCase, GetPrescriptionByCodeUseCase {

    private static final Pattern PRESCRIPTION_CODE_PATTERN = Pattern.compile("^RX\\d{6}$");

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionWarningLogRepository warningLogRepository;
    private final PrescriptionReadAccessValidator accessValidator;
    private final PrescriptionResultMapper resultMapper;

    @Override
    public PrescriptionResult getById(UUID prescriptionId) {
        var prescription = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> new PrescriptionNotFoundException(prescriptionId));
        accessValidator.requireCanRead(prescription);
        return resultMapper.toResult(
                prescription,
                warningLogRepository.findByPrescriptionId(prescriptionId)
        );
    }

    @Override
    public PrescriptionResult getByCode(String prescriptionCode) {
        if (prescriptionCode == null || prescriptionCode.isBlank()) {
            throw new ValidationException("Prescription code is required.");
        }
        String normalizedCode = prescriptionCode.trim().toUpperCase();
        if (!PRESCRIPTION_CODE_PATTERN.matcher(normalizedCode).matches()) {
            throw new PrescriptionNotFoundException(normalizedCode);
        }
        var prescription = prescriptionRepository.findByPrescriptionCode(normalizedCode)
                .orElseThrow(() -> new PrescriptionNotFoundException(normalizedCode));
        accessValidator.requireCanRead(prescription);
        return resultMapper.toResult(
                prescription,
                warningLogRepository.findByPrescriptionId(prescription.getId())
        );
    }
}
