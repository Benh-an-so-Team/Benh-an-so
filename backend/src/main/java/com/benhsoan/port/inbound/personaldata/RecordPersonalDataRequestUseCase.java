package com.benhsoan.port.inbound.personaldata;

import com.benhsoan.port.dto.command.personaldata.RecordPersonalDataRequestCommand;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;

public interface RecordPersonalDataRequestUseCase {

    PersonalDataRequestResult record(RecordPersonalDataRequestCommand command);
}
