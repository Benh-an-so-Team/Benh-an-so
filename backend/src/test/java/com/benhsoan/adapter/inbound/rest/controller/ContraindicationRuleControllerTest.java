package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.ContraindicationRuleRestMapper;
import com.benhsoan.domain.contraindication.ContraindicationRule;
import com.benhsoan.domain.contraindication.enums.ContraindicationSeverity;
import com.benhsoan.domain.contraindication.enums.ContraindicationType;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.port.inbound.contraindication.ActivateContraindicationRuleUseCase;
import com.benhsoan.port.inbound.contraindication.CreateContraindicationRuleUseCase;
import com.benhsoan.port.inbound.contraindication.DeactivateContraindicationRuleUseCase;
import com.benhsoan.port.inbound.contraindication.SearchContraindicationRuleUseCase;
import com.benhsoan.port.inbound.contraindication.UpdateContraindicationRuleUseCase;

@WebMvcTest(controllers = ContraindicationRuleController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class ContraindicationRuleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean private SearchContraindicationRuleUseCase searchUseCase;
    @MockitoBean private CreateContraindicationRuleUseCase createUseCase;
    @MockitoBean private UpdateContraindicationRuleUseCase updateUseCase;
    @MockitoBean private DeactivateContraindicationRuleUseCase deactivateUseCase;
    @MockitoBean private ActivateContraindicationRuleUseCase activateUseCase;
    @MockitoBean private ContraindicationRuleRestMapper mapper;
    @MockitoBean private JwtAuthenticationFilter jwtAuthenticationFilter;

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");

    @Test
    void searchRulesReturnsOk() throws Exception {
        UUID ruleId = UUID.randomUUID();
        ContraindicationRule rule = ContraindicationRule.restore(
                ruleId, null, "Ibuprofen", ContraindicationType.PREGNANCY,
                null, null, null, ContraindicationSeverity.CONTRAINDICATED,
                "Chống chỉ định thai kỳ", "Dùng Paracetamol", true, NOW, null
        );

        when(searchUseCase.search(any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(rule), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/contraindication-rules")
                        .with(user("doctor").authorities(new SimpleGrantedAuthority("PERMISSION_CONTRAINDICATION_RULE_MANAGE"))))
                .andExpect(status().isOk());
    }

    @Test
    void createRuleReturnsCreated() throws Exception {
        UUID ruleId = UUID.randomUUID();
        ContraindicationRule rule = ContraindicationRule.restore(
                ruleId, null, "Ibuprofen", ContraindicationType.PREGNANCY,
                null, null, null, ContraindicationSeverity.CONTRAINDICATED,
                "Chống chỉ định thai kỳ", "Dùng Paracetamol", true, NOW, null
        );

        when(createUseCase.create(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(rule);

        String json = """
                {
                    "activeIngredient": "Ibuprofen",
                    "type": "PREGNANCY",
                    "severity": "CONTRAINDICATED",
                    "message": "Chống chỉ định thai kỳ",
                    "recommendation": "Dùng Paracetamol"
                }
                """;

        mockMvc.perform(post("/contraindication-rules")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_CONTRAINDICATION_RULE_MANAGE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated());
    }

    @Test
    void deactivateRuleReturnsNoContent() throws Exception {
        UUID ruleId = UUID.randomUUID();
        doNothing().when(deactivateUseCase).deactivate(ruleId);

        mockMvc.perform(delete("/contraindication-rules/{id}", ruleId)
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_CONTRAINDICATION_RULE_MANAGE"))))
                .andExpect(status().isNoContent());
    }

    @Test
    void importRulesAcceptsCsvFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "rules.csv",
                "text/csv",
                "active_ingredient,type,severity,message\nIbuprofen,PREGNANCY,CONTRAINDICATED,Warning".getBytes()
        );

        mockMvc.perform(multipart("/contraindication-rules/import")
                        .file(file)
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_CONTRAINDICATION_RULE_MANAGE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
