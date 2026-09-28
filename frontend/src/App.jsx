import React from 'react'
import AppRoutes from './routes/AppRoutes'
import './App.css'
import { ConfigProvider, message } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import ForceChangePasswordModal from './components/auth/ForceChangePasswordModal'
import SessionTimeoutWarningModal from './components/auth/SessionTimeoutWarningModal'

dayjs.locale('vi')

message.config({
  top: 20,
  maxCount: 2,
  duration: 3,
})

function App() {
  return (
    <ConfigProvider
        locale={viVN}
        theme={{
          token: {
            colorPrimary: '#2563EB',
            fontFamily: "Inter, 'Segoe UI', Roboto, Arial, sans-serif",
            borderRadius: 8,
            colorBgContainer: '#FFFFFF',
            colorBgLayout: '#F8FAFC',
            colorText: '#111827',
            colorTextSecondary: '#64748B',
            colorBorder: '#E2E8F0',
            colorSuccess: '#16A34A',
            colorWarning: '#D97706',
            colorError: '#DC2626',
            controlHeight: 38,
            controlHeightSM: 30,
            controlHeightLG: 44,
          },
          components: {
            Card: {
              paddingLG: 20,
              borderRadiusLG: 10,
            },
            Button: {
              controlHeight: 38,
              controlHeightSM: 30,
              controlHeightLG: 44,
              fontWeight: 600,
              fontSize: 13.5,
              fontSizeSM: 13,
              fontSizeLG: 15,
              borderRadius: 6,
              borderRadiusSM: 6,
              borderRadiusLG: 8,
              paddingInline: 16,
              paddingInlineSM: 12,
              paddingInlineLG: 20,
            },
            Input: {
              controlHeight: 38,
              controlHeightSM: 30,
              controlHeightLG: 44,
              borderRadius: 6,
            },
            Select: {
              controlHeight: 38,
              controlHeightSM: 30,
              controlHeightLG: 44,
              borderRadius: 6,
            },
            DatePicker: {
              controlHeight: 38,
              controlHeightSM: 30,
              controlHeightLG: 44,
              borderRadius: 6,
            },
            Modal: {
              borderRadiusLG: 12,
            },
          },
        }}
      >
        <ForceChangePasswordModal />
        <SessionTimeoutWarningModal />
        <AppRoutes />
      </ConfigProvider>
  )
}

export default App
