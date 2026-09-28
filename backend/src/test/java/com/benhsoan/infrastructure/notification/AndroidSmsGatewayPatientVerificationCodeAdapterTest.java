package com.benhsoan.infrastructure.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

@DisplayName("Android SMS Gateway Patient Verification Code Adapter Tests")
class AndroidSmsGatewayPatientVerificationCodeAdapterTest {

    private static final String GATEWAY_URL = "https://api.sms-gate.app/3rdparty/v1/message";
    private static final String USERNAME = "LRIMS3";
    private static final String PASSWORD = "050jm5oro3ihgy";

    private MockRestServiceServer mockServer;
    private AndroidSmsGatewayPatientVerificationCodeAdapter adapter;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();

        adapter = new AndroidSmsGatewayPatientVerificationCodeAdapter(
                restClient,
                GATEWAY_URL,
                USERNAME,
                PASSWORD
        );
    }

    @Test
    @DisplayName("formatToE164 should correctly format Vietnamese numbers to E.164")
    void formatToE164_formatsCorrectly() {
        assertEquals("+84777466516", adapter.formatToE164("0777466516"));
        assertEquals("+84901111222", adapter.formatToE164("0901111222"));
        assertEquals("+84901111222", adapter.formatToE164("+84901111222"));
        assertEquals("+84901111222", adapter.formatToE164("84901111222"));
        assertEquals("", adapter.formatToE164(""));
        assertEquals("", adapter.formatToE164(null));
    }

    @Test
    @DisplayName("sendVerificationCode should dispatch POST request with Basic Auth and E.164 phone")
    void sendVerificationCode_success() {
        mockServer.expect(requestTo(GATEWAY_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Basic TFJJTVMzOjA1MGptNW9ybzNpaGd5"))
                .andExpect(header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE))
                .andExpect(jsonPath("$.phoneNumbers[0]").value("+84777466516"))
                .andExpect(jsonPath("$.message").value("[BENH AN SO] Ma xac thuc khoi phuc mat khau cua ban la: 123456. Ma co hieu luc trong 5 phut."))
                .andRespond(withSuccess("{\"id\":\"msg-1\",\"state\":\"Pending\"}", MediaType.APPLICATION_JSON));

        adapter.sendVerificationCode("0777466516", "123456", 300);

        mockServer.verify();
    }

    @Test
    @DisplayName("sendVerificationCode should handle HTTP error without throwing exception to caller")
    void sendVerificationCode_handlesHttpErrorGracefully() {
        mockServer.expect(requestTo(GATEWAY_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withBadRequest().body("{\"message\":\"invalid phone number\"}"));

        // Should not throw exception
        adapter.sendVerificationCode("0777466516", "123456", 300);

        mockServer.verify();
    }
}
