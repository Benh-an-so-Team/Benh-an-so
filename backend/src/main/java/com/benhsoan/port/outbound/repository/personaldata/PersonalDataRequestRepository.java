package com.benhsoan.port.outbound.repository.personaldata;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.benhsoan.domain.personaldata.PersonalDataRequest;
import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;

public interface PersonalDataRequestRepository {

    PersonalDataRequest save(PersonalDataRequest request);

    Optional<PersonalDataRequest> findById(UUID id);

    Optional<PersonalDataRequest> findByIdForUpdate(UUID id);

    Page<PersonalDataRequest> search(
            UUID patientId,
            PersonalDataRequestStatus status,
            boolean overdueOnly,
            Instant now,
            Instant dueFrom,
            Instant dueTo,
            Pageable pageable);

    List<PersonalDataRequest> findOpenWithDueBefore(Instant now);

    List<PersonalDataRequest> findOpenWithDueBetween(Instant fromInclusive, Instant toInclusive);
}
