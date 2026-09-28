package com.benhsoan.port.inbound.personaldata;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.benhsoan.port.dto.query.personaldata.SearchPersonalDataRequestsQuery;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;

public interface SearchPersonalDataRequestsUseCase {

    Page<PersonalDataRequestResult> search(SearchPersonalDataRequestsQuery query, Pageable pageable);
}
