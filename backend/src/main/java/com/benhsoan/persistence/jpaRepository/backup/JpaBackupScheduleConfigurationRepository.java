package com.benhsoan.persistence.jpaRepository.backup;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.persistence.entity.backup.BackupScheduleConfigurationEntity;

public interface JpaBackupScheduleConfigurationRepository
        extends JpaRepository<BackupScheduleConfigurationEntity, UUID> {

    Optional<BackupScheduleConfigurationEntity> findFirstByOrderByUpdatedAtDesc();
}
