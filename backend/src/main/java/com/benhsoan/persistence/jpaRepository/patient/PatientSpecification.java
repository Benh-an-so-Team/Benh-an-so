package com.benhsoan.persistence.jpaRepository.patient;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import com.benhsoan.persistence.entity.patient.PatientEntity;
import com.benhsoan.port.dto.command.patient.SearchPatientCommand;

import jakarta.persistence.criteria.Predicate;

public class PatientSpecification {

    public static Specification<PatientEntity> build(
            SearchPatientCommand command
    ) {

        return (root, query, cb) -> {

            if (command == null) {
                return cb.conjunction();
            }

            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(command.patientCode())) {
                predicates.add(
                        cb.equal(
                                root.get("patientCode"),
                                command.patientCode()
                        )
                );
            }

            if (StringUtils.hasText(command.fullName())) {
                predicates.add(
                        cb.like(
                                cb.lower(root.get("fullName")),
                                "%" + command.fullName().toLowerCase() + "%"
                        )
                );
            }

            if (StringUtils.hasText(command.phone())) {
                predicates.add(
                        cb.equal(
                                root.get("phone"),
                                command.phone()
                        )
                );
            }

            if (StringUtils.hasText(command.identityNumber())) {
                predicates.add(
                        cb.equal(
                                root.get("identityNumber"),
                                command.identityNumber()
                        )
                );
            }

            if (StringUtils.hasText(command.insuranceNumber())) {
                predicates.add(
                        cb.equal(
                                root.get("insuranceNumber"),
                                command.insuranceNumber()
                        )
                );
            }

            if (command.dateOfBirth() != null) {
                predicates.add(
                        cb.equal(
                                root.get("dateOfBirth"),
                                command.dateOfBirth()
                        )
                );
            }

            if (command.gender() != null) {
                predicates.add(
                        cb.equal(
                                root.get("gender"),
                                command.gender()
                        )
                );
            }

            if (command.active() != null) {
                predicates.add(
                        cb.equal(
                                root.get("active"),
                                command.active()
                        )
                );
            }

            if (query != null && !Long.class.equals(query.getResultType()) && !long.class.equals(query.getResultType())) {
                query.orderBy(
                        cb.desc(root.get("createdAt"))
                );
            }

            return cb.and(
                    predicates.toArray(new Predicate[0])
            );
        };
    }

    private PatientSpecification() {
    }
}