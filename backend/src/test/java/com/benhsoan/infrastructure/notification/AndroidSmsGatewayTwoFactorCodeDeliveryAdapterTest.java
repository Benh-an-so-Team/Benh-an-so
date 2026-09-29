package com.benhsoan.infrastructure.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.benhsoan.domain.auth.User;
import com.benhsoan.port.outbound.repository.auth.UserRepository;

@DisplayName("Android SMS Gateway Two-Factor Code Delivery Adapter Tests (NCL-01-CN-006)")
class AndroidSmsGatewayTwoFactorCodeDeliveryAdapterTest {

    private static final String GATEWAY_URL = "https://api.sms-gate.app/3rdparty/v1/message";
    private static final String USERNAME = "LRIMS3";
    private static final String PASSWORD = "050jm5oro3ihgy";

    private MockRestServiceServer mockServer;
    private UserRepository userRepository;
    private AndroidSmsGatewayTwoFactorCodeDeliveryAdapter adapter;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();
        userRepository = mock(UserRepository.class);

        adapter = new AndroidSmsGatewayTwoFactorCodeDeliveryAdapter(
                restClient,
                userRepository,
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
    @DisplayName("sendVerificationCode should dispatch POST request with Basic Auth and E.164 phone when user has phone")
    void sendVerificationCode_success() {
        User user = mock(User.class);
        when(user.getPhone()).thenReturn("0777466516");
        when(userRepository.findByUsername("doctor1")).thenReturn(Optional.of(user));

        mockServer.expect(requestTo(GATEWAY_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Basic TFJJTVMzOjA1MGptNW9ybzNpaGd5"))
                .andExpect(header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE))
                .andExpect(jsonPath("$.phoneNumbers[0]").value("+84777466516"))
                .andExpect(jsonPath("$.message").value("[BENH AN SO] Ma xac thuc 2FA dang nhap he thong cua ban la: 123456. Ma co hieu luc trong 5 phut."))
                .andRespond(withSuccess("{\"id\":\"msg-2fa-1\",\"state\":\"Pending\"}", MediaType.APPLICATION_JSON));

        adapter.sendVerificationCode("doctor1", "123456", 300);

        mockServer.verify();
    }

    @Test
    @DisplayName("sendVerificationCode should handle HTTP error gracefully without throwing exception")
    void sendVerificationCode_handlesHttpErrorGracefully() {
        User user = mock(User.class);
        when(user.getPhone()).thenReturn("0777466516");
        when(userRepository.findByUsername("doctor1")).thenReturn(Optional.of(user));

        mockServer.expect(requestTo(GATEWAY_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withBadRequest().body("{\"message\":\"quota exceeded\"}"));

        // Should not throw exception
        adapter.sendVerificationCode("doctor1", "123456", 300);

        mockServer.verify();
    }

    @Test
    @DisplayName("sendVerificationCode should not call gateway if user not found")
    void sendVerificationCode_userNotFound() {
        when(userRepository.findByUsername("unknown_user")).thenReturn(Optional.empty());

        // Should not throw exception and should not call mockServer
        adapter.sendVerificationCode("unknown_user", "123456", 300);

        mockServer.verify();
    }

    @Test
    @DisplayName("sendVerificationCode should not call gateway if user has no phone")
    void sendVerificationCode_userNoPhone() {
        User user = mock(User.class);
        when(user.getPhone()).thenReturn(null);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));

        // Should not throw exception and should not call mockServer
        adapter.sendVerificationCode("admin", "123456", 300);

        mockServer.verify();
    }
}
