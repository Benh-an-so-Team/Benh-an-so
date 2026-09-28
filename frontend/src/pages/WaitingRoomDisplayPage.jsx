import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MedicineBoxOutlined,
  ClockCircleOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  ReloadOutlined,
  AlertOutlined,
  UserOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  DisconnectOutlined,
} from '@ant-design/icons'
import queueApi from '../api/queueApi'
import {
  formatDisplayTime,
  formatCalledAtTime,
  getPriorityBadge,
  sanitizeDisplayItem,
  getRoomStatusLabel,
  getRoomStatusCode,
} from '../utils/waitingRoomDisplayHelpers'

/**
 * WaitingRoomDisplayPage (NCL-03-CN-014 / QTN-43 / QTN-03)
 * 
 * Màn hình công cộng hiển thị số thứ tự tại khu vực chờ (Kiosk / Smart TV).
 * - Endpoint: GET /queues/display (PUBLIC - permitAll)
 * - Che thông tin nhận dạng: Chỉ hiển thị patientInitials (ví dụ: "N. V. A")
 * - Tự động cập nhật mỗi 10 giây (polling)
 * - Không crash khi mất mạng (giữ cache cũ + hiển thị cảnh báo nhỏ)
 * - Thiết kế tối ưu cho TV độ phân giải cao, nhìn rõ từ xa
 */
export default function WaitingRoomDisplayPage() {
  const [searchParams] = useSearchParams()
  const roomIdFromUrl = searchParams.get('roomId')

  // Clock state (updates every 1s)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Board data state
  const [boardData, setBoardData] = useState({
    date: null,
    updatedAt: null,
    rooms: [],
  })
  const [loading, setLoading] = useState(true)
  const [networkError, setNetworkError] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Polling ref to prevent state updates after unmount
  const isMountedRef = useRef(true)

  // 1. Digital Clock (independent 1-second interval)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 2. Fetch Board Data
  const fetchBoardData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    try {
      const params = {}
      if (roomIdFromUrl && roomIdFromUrl.trim()) {
        params.roomId = roomIdFromUrl.trim()
      }

      const response = await queueApi.getWaitingRoomDisplay(params)
      if (!isMountedRef.current) return

      const data = response?.data || {}
      setBoardData({
        date: data.date || null,
        updatedAt: data.updatedAt || new Date().toISOString(),
        rooms: Array.isArray(data.rooms) ? data.rooms : [],
      })
      setNetworkError(false)
    } catch (err) {
      if (!isMountedRef.current) return
      // Never crash or clear old cached data on network glitch
      setNetworkError(true)
    } finally {
      if (isMountedRef.current && isInitial) {
        setLoading(false)
      }
    }
  }, [roomIdFromUrl])

  // 3. Setup Polling (10 seconds)
  useEffect(() => {
    isMountedRef.current = true
    fetchBoardData(true)

    const pollInterval = setInterval(() => {
      fetchBoardData(false)
    }, 10000)

    return () => {
      isMountedRef.current = false
      clearInterval(pollInterval)
    }
  }, [fetchBoardData])

  // 4. Fullscreen handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch(() => {})
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false)
        }).catch(() => {})
      }
    }
  }

  // Listen for fullscreen change events (e.g. Esc key pressed)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // Format digital clock strings
  const formattedHours = String(currentTime.getHours()).padStart(2, '0')
  const formattedMinutes = String(currentTime.getMinutes()).padStart(2, '0')
  const formattedSeconds = String(currentTime.getSeconds()).padStart(2, '0')
  const formattedDate = currentTime.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const rooms = boardData.rooms || []

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#070b14',
        color: '#f8fafc',
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        padding: '16px 24px',
      }}
    >
      <style>{`
        @keyframes emergencyPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); border-color: #ef4444; }
          50% { box-shadow: 0 0 25px 8px rgba(239, 68, 68, 0.4); border-color: #f87171; }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); border-color: #ef4444; }
        }
        @keyframes callingGlow {
          0% { text-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }
          50% { text-shadow: 0 0 25px rgba(56, 189, 248, 0.8), 0 0 40px rgba(14, 165, 233, 0.4); }
          100% { text-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }
        }
        @keyframes subtleBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* TOP HEADER: Branding, Realtime Clock, Controls */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a',
          borderRadius: 16,
          padding: '14px 28px',
          marginBottom: 20,
          border: '1px solid #1e293b',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Clinic Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
            }}
          >
            <MedicineBoxOutlined style={{ fontSize: 28, color: '#ffffff' }} />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '0.5px',
                color: '#ffffff',
                textTransform: 'uppercase',
              }}
            >
              BẢNG THEO DÕI HÀNG ĐỢI KHÁM BỆNH
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>
                Khu vực chờ khám • Màn hình công cộng (QTN-43)
              </span>
              <span style={{ color: '#475569' }}>•</span>
              <span style={{ fontSize: 13, color: '#38bdf8' }}>
                Cập nhật lúc: {formatDisplayTime(boardData.updatedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Network status warning pill (if error) */}
        {networkError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#451a03',
              border: '1px solid #b45309',
              color: '#fef3c7',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              animation: 'subtleBlink 2s infinite',
            }}
          >
            <DisconnectOutlined style={{ color: '#f59e0b' }} />
            <span>Mất kết nối tạm thời — Đang thử lại...</span>
          </div>
        )}

        {/* Clock & Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Digital Clock */}
          <div
            style={{
              textAlign: 'right',
              backgroundColor: '#020617',
              padding: '8px 20px',
              borderRadius: 12,
              border: '1px solid #1e293b',
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 2,
                color: '#38bdf8',
                fontFamily: 'monospace, monospace',
                lineHeight: 1.1,
              }}
            >
              {formattedHours}:{formattedMinutes}
              <span style={{ fontSize: 20, color: '#0284c7' }}>:{formattedSeconds}</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, textTransform: 'capitalize' }}>
              {formattedDate}
            </div>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ màn hình' : 'Mở toàn màn hình'}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 10,
              color: '#cbd5e1',
              padding: '10px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              fontSize: 18,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#334155'
              e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1e293b'
              e.currentTarget.style.color = '#cbd5e1'
            }}
          >
            {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          </button>
        </div>
      </header>

      {/* MAIN CONTENT: Grid of Clinic Rooms */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {loading && rooms.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              minHeight: 400,
            }}
          >
            <ReloadOutlined spin style={{ fontSize: 44, color: '#38bdf8' }} />
            <div style={{ fontSize: 18, color: '#94a3b8' }}>Đang nạp dữ liệu hàng đợi khám...</div>
          </div>
        ) : rooms.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0f172a',
              borderRadius: 20,
              border: '1px solid #1e293b',
              padding: 40,
              textAlign: 'center',
              minHeight: 400,
            }}
          >
            <CheckCircleOutlined style={{ fontSize: 56, color: '#10b981', marginBottom: 16 }} />
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              Hiện chưa có phòng khám nào hoạt động
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', marginTop: 8 }}>
              Hàng đợi khám sẽ tự động xuất hiện khi phòng khám bắt đầu tiếp nhận bệnh nhân.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: rooms.length === 1
                ? '1fr'
                : rooms.length === 2
                ? 'repeat(2, 1fr)'
                : rooms.length <= 4
                ? 'repeat(2, 1fr)'
                : 'repeat(3, 1fr)',
              gap: 20,
              alignItems: 'stretch',
            }}
          >
            {rooms.map((room) => {
              const currentCalling = room.currentCalling ? sanitizeDisplayItem(room.currentCalling) : null
              const rawWaitingList = Array.isArray(room.waitingList) ? room.waitingList : []
              // PRESERVE BACKEND SORT ORDER (DO NOT RE-SORT)
              const waitingList = rawWaitingList.map(sanitizeDisplayItem).filter(Boolean)
              const isCallingEmergency = currentCalling?.priority === 'EMERGENCY'
              const roomStatusCode = getRoomStatusCode(currentCalling, waitingList)
              const roomStatusLabel = getRoomStatusLabel(currentCalling, waitingList)

              return (
                <div
                  key={room.roomId || room.roomNumber}
                  style={{
                    backgroundColor: '#0f172a',
                    borderRadius: 18,
                    border: isCallingEmergency
                      ? '2px solid #ef4444'
                      : '1px solid #1e293b',
                    boxShadow: isCallingEmergency
                      ? '0 0 25px rgba(239, 68, 68, 0.35)'
                      : '0 8px 24px rgba(0, 0, 0, 0.3)',
                    animation: isCallingEmergency ? 'emergencyPulse 2s infinite' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {/* Room Card Header */}
                  <div
                    style={{
                      backgroundColor: '#1e293b',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #334155',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          padding: '6px 14px',
                          borderRadius: 8,
                          fontSize: 18,
                          fontWeight: 800,
                          letterSpacing: 1,
                        }}
                      >
                        {room.roomNumber || 'PK'}
                      </span>
                      <div>
                        <h2
                          style={{
                            margin: 0,
                            fontSize: 18,
                            fontWeight: 700,
                            color: '#ffffff',
                          }}
                        >
                          {room.roomName || 'Phòng Khám'}
                        </h2>
                        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                          {room.doctorName ? `BS. ${room.doctorName}` : 'Chưa phân công bác sĩ'}
                        </div>
                      </div>
                    </div>

                    {/* Room Status Badge */}
                    <div
                      style={{
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        backgroundColor:
                          roomStatusCode === 'CALLING'
                            ? '#064e3b'
                            : roomStatusCode === 'WAITING_NEXT'
                            ? '#1e3a5f'
                            : '#1e293b',
                        color:
                          roomStatusCode === 'CALLING'
                            ? '#34d399'
                            : roomStatusCode === 'WAITING_NEXT'
                            ? '#38bdf8'
                            : '#94a3b8',
                        border:
                          roomStatusCode === 'CALLING'
                            ? '1px solid #059669'
                            : roomStatusCode === 'WAITING_NEXT'
                            ? '1px solid #0284c7'
                            : '1px solid #475569',
                      }}
                    >
                      {roomStatusLabel}
                    </div>
                  </div>

                  {/* Room Card Body: Current Calling Area */}
                  <div
                    style={{
                      padding: '24px 20px',
                      textAlign: 'center',
                      background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 70%)',
                      borderBottom: '1px solid #1e293b',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 220,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 2,
                        color: currentCalling ? '#38bdf8' : '#64748b',
                        marginBottom: 8,
                      }}
                    >
                      ĐANG KHÁM
                    </div>

                    {currentCalling ? (
                      <div>
                        {/* Huge Queue Number */}
                        <div
                          style={{
                            fontSize: 84,
                            fontWeight: 900,
                            lineHeight: 1,
                            color: isCallingEmergency ? '#f87171' : '#38bdf8',
                            fontFamily: 'monospace, monospace',
                            animation: isCallingEmergency ? 'none' : 'callingGlow 3s infinite',
                            margin: '4px 0 10px 0',
                          }}
                        >
                          {currentCalling.queueNumber}
                        </div>

                        {/* Patient Initials (Anonymized - QTN-43) */}
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: '#f8fafc',
                            letterSpacing: 1,
                          }}
                        >
                          Bệnh nhân: {currentCalling.patientInitials || '---'}
                        </div>

                        {/* Priority & Call time badges */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            marginTop: 10,
                          }}
                        >
                          {(() => {
                            const badge = getPriorityBadge(currentCalling.priority)
                            return (
                              <span
                                style={{
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border}`,
                                  padding: '4px 10px',
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: 800,
                                }}
                              >
                                {badge.isEmergency && <AlertOutlined style={{ marginRight: 4 }} />}
                                {badge.label}
                              </span>
                            )
                          })()}

                          {currentCalling.calledAt && (
                            <span
                              style={{
                                color: '#94a3b8',
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <ClockCircleOutlined />
                              Gọi lúc: {formatCalledAtTime(currentCalling.calledAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '16px 0',
                        }}
                      >
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            backgroundColor: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12,
                            border: '1px solid #334155',
                          }}
                        >
                          <ClockCircleOutlined style={{ fontSize: 28, color: '#64748b' }} />
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#94a3b8' }}>
                          Sẵn sàng đón bệnh nhân
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                          Đang chờ bác sĩ gọi số tiếp theo
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Room Card Footer: Waiting List (Next Patients) */}
                  <div
                    style={{
                      backgroundColor: '#090e1a',
                      padding: '14px 18px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                          color: '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <TeamOutlined />
                        <span>SỐ KẾ TIẾP CHỜ KHÁM</span>
                      </div>
                      <span
                        style={{
                          backgroundColor: '#1e293b',
                          color: '#38bdf8',
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {waitingList.length} đang chờ
                      </span>
                    </div>

                    {waitingList.length === 0 ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: '#475569',
                          textAlign: 'center',
                          padding: '8px 0',
                          fontStyle: 'italic',
                        }}
                      >
                        Không có bệnh nhân chờ
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {waitingList.slice(0, 4).map((wItem, idx) => {
                          const badge = getPriorityBadge(wItem.priority)
                          const isSpecial = wItem.priority === 'EMERGENCY' || wItem.priority === 'PRIORITY'

                          return (
                            <div
                              key={wItem.id || `${wItem.queueNumber}-${idx}`}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: isSpecial
                                  ? badge.bg
                                  : idx === 0
                                  ? '#131e33'
                                  : '#0f172a',
                                border: isSpecial
                                  ? `1px solid ${badge.border}`
                                  : idx === 0
                                  ? '1px solid #1e3a8a'
                                  : '1px solid #1e293b',
                                borderRadius: 8,
                                padding: '8px 12px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span
                                  style={{
                                    fontSize: 16,
                                    fontWeight: 800,
                                    color: isSpecial ? badge.color : '#38bdf8',
                                    fontFamily: 'monospace, monospace',
                                    minWidth: 36,
                                  }}
                                >
                                  #{wItem.queueNumber}
                                </span>
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: isSpecial ? '#1e293b' : '#e2e8f0',
                                  }}
                                >
                                  {wItem.patientInitials || '---'}
                                </span>
                              </div>

                              {isSpecial ? (
                                <span
                                  style={{
                                    backgroundColor: badge.color,
                                    color: '#ffffff',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  {badge.label}
                                </span>
                              ) : idx === 0 ? (
                                <span
                                  style={{
                                    color: '#38bdf8',
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  Lượt kế
                                </span>
                              ) : null}
                            </div>
                          )
                        })}

                        {waitingList.length > 4 && (
                          <div
                            style={{
                              textAlign: 'center',
                              fontSize: 12,
                              color: '#64748b',
                              paddingTop: 2,
                            }}
                          >
                            + {waitingList.length - 4} bệnh nhân tiếp theo trong hàng đợi
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* FOOTER: Compliance Note */}
      <footer
        style={{
          marginTop: 20,
          textAlign: 'center',
          fontSize: 12,
          color: '#475569',
          borderTop: '1px solid #1e293b',
          paddingTop: 12,
        }}
      >
        Hệ thống chuyển đổi số cơ sở khám chữa bệnh • Tuân thủ chuẩn bảo vệ danh tính bệnh nhân QTN-43 • Tự động làm mới mỗi 10 giây
      </footer>
    </div>
  )
}
