package com.benhsoan.persistence.adapterRepository.survey;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.benhsoan.domain.survey.PatientSatisfactionSurvey;
import com.benhsoan.persistence.entity.auth.UserEntity;
import com.benhsoan.persistence.jpaRepository.survey.JpaSatisfactionSurveyRepository;
import com.benhsoan.persistence.mapper.survey.SatisfactionSurveyPersistenceMapper;
import com.benhsoan.port.outbound.repository.survey.DoctorSatisfactionSummary;
import com.benhsoan.port.outbound.repository.survey.SatisfactionOverallSummary;
import com.benhsoan.port.outbound.repository.survey.SatisfactionScoreCount;

import jakarta.persistence.EntityManager;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.sql.init.mode=never",
        "spring.datasource.url=jdbc:h2:mem:satisfaction-survey-test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class SatisfactionSurveyRepositoryAdapterIntegrationTest {

    private static final Instant FROM = Instant.parse("2026-09-01T00:00:00Z");
    private static final Instant TO = Instant.parse("2026-09-25T23:59:59Z");

    @Autowired
    private JpaSatisfactionSurveyRepository jpaRepository;

    @Autowired
    private EntityManager entityManager;

    private SatisfactionSurveyRepositoryAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new SatisfactionSurveyRepositoryAdapter(
                jpaRepository,
                new SatisfactionSurveyPersistenceMapper(),
                entityManager
        );
    }

    @Test
    @DisplayName("Lưu và tìm kiếm khảo sát thành công")
    void saveAndFindSurvey_Success() {
        UUID visitId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID doctorId = createDoctor("dr.anh", "Dr. Nguyen Minh Anh");

        PatientSatisfactionSurvey survey = PatientSatisfactionSurvey.create(
                visitId, patientId, doctorId, 5, "Dịch vụ xuất sắc", FROM.plusSeconds(3600)
        );

        PatientSatisfactionSurvey saved = adapter.save(survey);
        assertNotNull(saved);
        assertEquals(visitId, saved.getVisitId());
        assertEquals(5, saved.getScore());
        assertEquals("Dịch vụ xuất sắc", saved.getComment());

        assertTrue(adapter.existsByVisitId(visitId));
        assertTrue(adapter.findByVisitId(visitId).isPresent());
        assertEquals(saved.getId(), adapter.findById(saved.getId()).orElseThrow().getId());
    }

    @Test
    @DisplayName("Tính toán báo cáo tổng hợp, phân bố điểm và theo bác sĩ ở mức database")
    void getSatisfactionReports_CalculatedCorrectlyInDatabase() {
        UUID doctorA = createDoctor("dr.anh", "Dr. Nguyen Minh Anh");
        UUID doctorB = createDoctor("dr.huy", "Dr. Tran Quang Huy");

        // Doctor A: 2 surveys (score 5, score 4) -> avg 4.5
        adapter.save(PatientSatisfactionSurvey.create(UUID.randomUUID(), UUID.randomUUID(), doctorA, 5, "Tot", FROM.plusSeconds(100)));
        adapter.save(PatientSatisfactionSurvey.create(UUID.randomUUID(), UUID.randomUUID(), doctorA, 4, "Kha", FROM.plusSeconds(200)));

        // Doctor B: 1 survey (score 3) -> avg 3.0
        adapter.save(PatientSatisfactionSurvey.create(UUID.randomUUID(), UUID.randomUUID(), doctorB, 3, "Binh thuong", FROM.plusSeconds(300)));

        entityManager.flush();
        entityManager.clear();

        // 1. Overall Summary
        SatisfactionOverallSummary overall = adapter.getOverallSummary(FROM, TO, null);
        assertEquals(3L, overall.totalSurveys());
        assertEquals(4.0, overall.averageScore(), 0.01); // (5 + 4 + 3) / 3 = 4.0

        // 2. Score Distribution
        List<SatisfactionScoreCount> dist = adapter.getScoreDistribution(FROM, TO, null);
        assertEquals(3, dist.size()); // scores 3, 4, 5

        // 3. Doctor Summaries - All Doctors
        List<DoctorSatisfactionSummary> doctorSummaries = adapter.getDoctorSummaries(FROM, TO, null);
        assertEquals(2, doctorSummaries.size());
        assertEquals("Dr. Nguyen Minh Anh", doctorSummaries.get(0).doctorFullName());
        assertEquals(2L, doctorSummaries.get(0).totalSurveys());
        assertEquals(4.5, doctorSummaries.get(0).averageScore(), 0.01);

        assertEquals("Dr. Tran Quang Huy", doctorSummaries.get(1).doctorFullName());
        assertEquals(1L, doctorSummaries.get(1).totalSurveys());
        assertEquals(3.0, doctorSummaries.get(1).averageScore(), 0.01);

        // 4. Doctor Summaries - Filtered by Doctor A
        List<DoctorSatisfactionSummary> filteredSummaries = adapter.getDoctorSummaries(FROM, TO, doctorA);
        assertEquals(1, filteredSummaries.size());
        assertEquals(doctorA, filteredSummaries.get(0).doctorId());
        assertEquals(2L, filteredSummaries.get(0).totalSurveys());
        assertEquals(4.5, filteredSummaries.get(0).averageScore(), 0.01);
    }

    private UUID createDoctor(String username, String fullName) {
        UUID id = UUID.randomUUID();
        UserEntity doctor = UserEntity.builder()
                .id(id)
                .username(username)
                .passwordHash("hashed")
                .fullName(fullName)
                .email(username + "@clinic.com")
                .phone("0901000000")
                .roleId(UUID.randomUUID())
                .active(true)
                .mustChangePassword(false)
                .createdAt(FROM.minusSeconds(86400))
                .build();
        entityManager.persist(doctor);
        return id;
    }
}
