package com.benhsoan.persistence.jpaRepository.personaldata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;
import com.benhsoan.persistence.entity.personaldata.PersonalDataRequestEntity;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.sql.init.mode=never",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class JpaPersonalDataRequestRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-09-26T08:00:00Z");

    @Autowired private JpaPersonalDataRequestRepository repository;

    @Test
    void searchIsInclusiveOnBothBoundsForFromToRange() {
        Instant t1 = NOW.plusSeconds(3600);
        Instant t2 = NOW.plusSeconds(7200);
        save("A", t1);
        save("B", t2);
        save("C", t2.plusSeconds(1));

        Page<PersonalDataRequestEntity> page = repository.search(
                null, null, false, NOW, t1, t2, PageRequest.of(0, 20));

        assertEquals(2, page.getTotalElements());
    }

    @Test
    void searchFromEqualToToReturnsTheSingleBoundaryRecord() {
        Instant boundary = NOW.plusSeconds(3600);
        save("A", boundary);
        save("B", boundary.plusSeconds(1));

        Page<PersonalDataRequestEntity> page = repository.search(
                null, null, false, NOW, boundary, boundary, PageRequest.of(0, 20));

        assertEquals(1, page.getTotalElements());
        assertEquals("A", page.getContent().get(0).getRequestType());
    }

    @Test
    void searchDueToInclusiveIncludesBoundaryAndExcludesBeyond() {
        Instant boundary = NOW.plusSeconds(3600);
        save("IN", boundary);
        save("OUT", boundary.plusSeconds(1));

        Page<PersonalDataRequestEntity> page = repository.search(
                null, null, false, NOW, null, boundary, PageRequest.of(0, 20));

        assertEquals(1, page.getTotalElements());
        assertEquals("IN", page.getContent().get(0).getRequestType());
    }

    @Test
    void findOpenWithDueBetweenIsInclusiveOnBothBounds() {
        Instant windowStart = NOW;
        Instant windowEnd = NOW.plusSeconds(86400);
        save("LOWER", windowStart);
        save("INSIDE", windowStart.plusSeconds(1));
        save("UPPER", windowEnd);
        save("AFTER", windowEnd.plusSeconds(1));

        var result = repository.findByStatusAndDueAtBetweenOrderByDueAtAsc(
                PersonalDataRequestStatus.RECEIVED, windowStart, windowEnd);

        assertEquals(3, result.size());
        assertTrue(result.stream().anyMatch(e -> e.getRequestType().equals("LOWER")));
        assertTrue(result.stream().anyMatch(e -> e.getRequestType().equals("UPPER")));
        assertTrue(result.stream().noneMatch(e -> e.getRequestType().equals("AFTER")));
    }

    @Test
    void findByIdForUpdateReturnsTheRow() {
        save("LOCK", NOW.plusSeconds(3600));
        UUID id = repository.findAll().get(0).getId();

        assertTrue(repository.findByIdForUpdate(id).isPresent());
    }

    private void save(String requestType, Instant dueAt) {
        repository.saveAndFlush(PersonalDataRequestEntity.builder()
                .id(UUID.randomUUID())
                .patientId(UUID.randomUUID())
                .requestType(requestType)
                .status(PersonalDataRequestStatus.RECEIVED)
                .receivedAt(NOW)
                .dueAt(dueAt)
                .createdAt(NOW)
                .build());
    }
}