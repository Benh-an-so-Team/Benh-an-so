package com.benhsoan.application.ucservice.controlledmedicine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;

import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.controlledmedicine.ControlledMedicineRegister;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.controlledmedicine.SearchControlledMedicineRegisterQuery;
import com.benhsoan.port.dto.result.ControlledMedicineRegisterResult;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.controlledmedicine.ControlledMedicineRegisterRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;

class SearchControlledMedicineRegisterServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-21T10:00:00Z");

    private final ControlledMedicineRegisterRepository registerRepository = mock(
            ControlledMedicineRegisterRepository.class);
    private final PatientRepository patientRepository = mock(PatientRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);

    private SearchControlledMedicineRegisterService service;

    @BeforeEach
    void setUp() {
        service = new SearchControlledMedicineRegisterService(
                registerRepository,
                patientRepository,
                userRepository);
    }

    @Test
    void resolvesPrescriberDispenserAndPatientForRegisterRead() {
        UUID registerId = UUID.randomUUID();
        UUID prescriptionId = UUID.randomUUID();
        UUID prescriptionItemId = UUID.randomUUID();
        UUID medicineId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID pharmacistId = UUID.randomUUID();

        ControlledMedicineRegister record = ControlledMedicineRegister.restore(
                registerId,
                prescriptionId,
                prescriptionItemId,
                medicineId,
                "Morphine 10mg",
                patientId,
                doctorId,
                pharmacistId,
                5,
                NOW,
                NOW);

        Patient patient = mock(Patient.class);
        when(patient.getId()).thenReturn(patientId);
        when(patient.getPatientCode()).thenReturn("BN-0001");
        when(patient.getFullName()).thenReturn("Nguyen Van A");

        User doctor = mock(User.class);
        when(doctor.getId()).thenReturn(doctorId);
        when(doctor.getFullName()).thenReturn("Dr. B");

        User pharmacist = mock(User.class);
        when(pharmacist.getId()).thenReturn(pharmacistId);
        when(pharmacist.getFullName()).thenReturn("Pharmacist C");

        Page<ControlledMedicineRegister> page = new PageImpl<>(List.of(record));
        when(registerRepository.search(any(), any())).thenReturn(page);
        when(patientRepository.findAllById(any())).thenReturn(List.of(patient));
        when(userRepository.findAllById(any())).thenReturn(List.of(doctor, pharmacist));

        Page<ControlledMedicineRegisterResult> result = service.search(
                new SearchControlledMedicineRegisterQuery(null, null, null, null, 0, 20));

        ControlledMedicineRegisterResult item = result.getContent().getFirst();
        assertEquals(registerId, item.id());
        assertEquals(medicineId, item.medicineId());
        assertEquals("Morphine 10mg", item.medicineName());
        assertEquals(patientId, item.patientId());
        assertEquals("BN-0001", item.patientCode());
        assertEquals("Nguyen Van A", item.patientName());
        assertEquals(doctorId, item.prescribedBy());
        assertEquals("Dr. B", item.doctorName());
        assertEquals(pharmacistId, item.dispensedBy());
        assertEquals("Pharmacist C", item.pharmacistName());
        assertEquals(5, item.quantity());
        assertEquals(NOW, item.dispensedAt());
    }

    private void stubEmptyPage() {
        when(registerRepository.search(any(), any())).thenReturn(new PageImpl<>(List.of()));
    }

    @Test
    void acceptsFromBeforeTo() {
        stubEmptyPage();
        Instant from = NOW.minusSeconds(60);
        Instant to = NOW;

        service.search(new SearchControlledMedicineRegisterQuery(null, null, from, to, 0, 20));
    }

    @Test
    void acceptsFromEqualTo() {
        stubEmptyPage();

        service.search(new SearchControlledMedicineRegisterQuery(null, null, NOW, NOW, 0, 20));
    }

    @Test
    void rejectsFromAfterTo() {
        assertThrows(ValidationException.class, () -> service.search(
                new SearchControlledMedicineRegisterQuery(null, null, NOW, NOW.minusSeconds(60), 0, 20)));
    }

    @Test
    void acceptsSizeAtMaximum() {
        stubEmptyPage();

        service.search(new SearchControlledMedicineRegisterQuery(null, null, null, null, 0, 100));
    }

    @Test
    void rejectsSizeAboveMaximum() {
        assertThrows(ValidationException.class, () -> service.search(
                new SearchControlledMedicineRegisterQuery(null, null, null, null, 0, 101)));
    }

    @Test
    void acceptsNullDateRange() {
        stubEmptyPage();

        service.search(new SearchControlledMedicineRegisterQuery(null, null, null, null, 0, 20));
    }

    @Test
    void acceptsOpenEndedRange() {
        stubEmptyPage();

        service.search(new SearchControlledMedicineRegisterQuery(null, null, NOW, null, 0, 20));
        service.search(new SearchControlledMedicineRegisterQuery(null, null, null, NOW, 0, 20));
    }
}
