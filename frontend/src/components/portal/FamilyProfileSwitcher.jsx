import React, { useState } from 'react'
import { Button, Modal, Tag, Tooltip } from 'antd'
import {
  AlertOutlined,
  CheckCircleFilled,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  DEFAULT_ADULT_AGE_THRESHOLD,
  formatProfileAge,
  formatProfileRelationship,
  getAvatarColor,
  getProfileInitials,
  isAdultReviewRequired,
} from '../../utils/familyAppointmentHelpers.js'
import { showNotice, NOTICE_LEVELS } from '../common/notice/index.js'
import '../../pages/styles/familyProfileSwitcher.css'

function FamilyProfileSwitcher({
  profiles = [],
  selectedProfileId,
  onSelectProfile,
  mode = 'BOOKING', // 'BOOKING' | 'APPOINTMENTS'
  onUnlinkProfile,
  loading = false,
  allowViewAll = false,
  isViewAll = false,
  onToggleViewAll,
  adultAgeThreshold = DEFAULT_ADULT_AGE_THRESHOLD,
}) {
  const [unlinking, setUnlinking] = useState(false)

  // Xác định hồ sơ đang chọn
  const activeProfile = profiles.find(
    (p) => String(p.patientId) === String(selectedProfileId) || String(p.id) === String(selectedProfileId)
  ) || profiles.find((p) => p.self) || profiles[0] || null

  const hasDependents = profiles.some((p) => !p.self)
  const isAdultReviewNeeded = activeProfile && isAdultReviewRequired(activeProfile, adultAgeThreshold)

  const handleProfileClick = (profile) => {
    if (isViewAll && onToggleViewAll) {
      onToggleViewAll(false)
    }
    if (onSelectProfile) {
      onSelectProfile(profile)
    }
  }

  const handleConfirmUnlink = () => {
    if (!activeProfile) return

    Modal.confirm({
      title: 'Xác nhận gỡ liên kết hồ sơ người thân',
      icon: <ExclamationCircleOutlined style={{ color: '#d97706' }} />,
      content: (
        <div>
          <p>
            Bạn có chắc chắn muốn gỡ liên kết với hồ sơ <strong>{activeProfile.fullName}</strong> không?
          </p>
          <div style={{ background: '#fef3c7', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
            Hồ sơ này đã đủ {activeProfile.age || adultAgeThreshold} tuổi thành niên và chuyển sang tự quản lý. Sau khi gỡ liên kết:
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Hồ sơ sẽ không còn xuất hiện trong tài khoản của bạn</li>
              <li>Bạn sẽ không thể đặt lịch khám hoặc theo dõi lịch hẹn thay cho người này nữa</li>
            </ul>
          </div>
        </div>
      ),
      okText: 'Xác nhận gỡ liên kết',
      okType: 'danger',
      cancelText: 'Giữ lại',
      onOk: async () => {
        setUnlinking(true)
        try {
          if (onUnlinkProfile) {
            await onUnlinkProfile(activeProfile)
          }
          showNotice({
            level: NOTICE_LEVELS.SUCCESS,
            title: 'Gỡ liên kết thành công',
            message: 'Đã gỡ liên kết giám hộ thành công',
          })
        } catch {
          showNotice({
            level: NOTICE_LEVELS.ERROR,
            title: 'Lỗi',
            message: 'Không thể gỡ liên kết vào lúc này. Vui lòng thử lại sau.',
          })
        } finally {
          setUnlinking(false)
        }
      },
    })
  }

  return (
    <div className="family-profile-switcher-wrapper">
      <div className="family-switcher-header">
        <div className="family-switcher-title">
          <TeamOutlined style={{ color: '#2563eb' }} />
          <span>Hồ sơ người khám trong tài khoản</span>
          <span className="family-switcher-subtitle">
            ({profiles.length} hồ sơ liên kết)
          </span>
        </div>

        {allowViewAll && hasDependents && (
          <div>
            <Button
              size="small"
              type={isViewAll ? 'primary' : 'default'}
              onClick={() => onToggleViewAll && onToggleViewAll(!isViewAll)}
              style={isViewAll ? { background: '#2563eb', borderColor: '#2563eb' } : {}}
            >
              <TeamOutlined /> Xem tất cả người thân
            </Button>
          </div>
        )}
      </div>

      {/* Profiles Grid */}
      <div className="family-profiles-grid">
        {profiles.map((profile, idx) => {
          const isSelected = !isViewAll && activeProfile && (
            String(activeProfile.patientId) === String(profile.patientId) ||
            String(activeProfile.id) === String(profile.id)
          )
          const avatarColor = getAvatarColor(profile, idx)
          const initials = getProfileInitials(profile.fullName)
          const ageText = formatProfileAge(profile.age, profile.dateOfBirth)
          const relationshipText = formatProfileRelationship(profile.relationship, profile.self)
          const reviewWarning = isAdultReviewRequired(profile, adultAgeThreshold)

          return (
            <div
              key={profile.patientId || profile.id || idx}
              className={`family-profile-card ${isSelected ? 'is-active' : ''} ${reviewWarning ? 'has-review-warning' : ''}`}
              onClick={() => handleProfileClick(profile)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleProfileClick(profile)
              }}
              title={`Chọn hồ sơ: ${profile.fullName} (${relationshipText})`}
            >
              <div
                className="family-profile-avatar"
                style={{
                  background: avatarColor.bg,
                  color: avatarColor.text,
                  border: `2px solid ${avatarColor.border}`,
                }}
              >
                {initials}
              </div>

              <div className="family-profile-info">
                <div className="family-profile-name">{profile.fullName}</div>
                <div className="family-profile-tags">
                  <Tag
                    color={profile.self ? 'blue' : 'green'}
                    className="family-tag-relationship"
                    style={{ margin: 0 }}
                  >
                    {relationshipText}
                  </Tag>
                  {ageText && <span className="family-tag-age">{ageText}</span>}
                  {reviewWarning && (
                    <Tooltip title="Đề nghị rà soát gỡ liên kết do đã đủ tuổi thành niên">
                      <Tag color="warning" icon={<AlertOutlined />} style={{ margin: 0, padding: '0 4px', fontSize: 11 }}>
                        Rà soát
                      </Tag>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Thông báo rà soát liên kết thành niên (Banner nổi bật) */}
      {!isViewAll && isAdultReviewNeeded && activeProfile && (
        <div className="family-adult-review-banner">
          <ExclamationCircleOutlined className="family-adult-review-icon" />
          <div className="family-adult-review-body">
            <div className="family-adult-review-title">
              Thông báo rà soát liên kết người giám hộ
            </div>
            <div className="family-adult-review-desc">
              Hồ sơ <strong>{activeProfile.fullName}</strong> hiện đã đủ{' '}
              <strong>{activeProfile.age || adultAgeThreshold} tuổi</strong> (đủ tuổi thành niên theo quy định)
              để tự quản lý thông tin y tế cá nhân. Để tôn trọng quyền riêng tư và quyền tự quyết của người bệnh,
              hệ thống đề nghị bạn gỡ bỏ liên kết giám hộ đối với hồ sơ này.
            </div>
            <Button
              className="family-adult-review-btn"
              onClick={handleConfirmUnlink}
              loading={unlinking}
            >
              Xác nhận gỡ liên kết
            </Button>
          </div>
        </div>
      )}

      {/* Trạng thái chưa có người thân liên kết */}
      {!hasDependents && (
        <div className="family-no-dependents-guide">
          <InfoCircleOutlined className="family-no-dependents-icon" />
          <span>
            Tài khoản hiện chỉ có hồ sơ của chính bạn. Nếu muốn đặt lịch cho người thân (con nhỏ, người được giám hộ),
            vui lòng liên hệ trực tiếp tại <strong>quầy tiếp đón của phòng khám</strong> để được hỗ trợ xác minh và tạo liên kết bảo mật.
          </span>
        </div>
      )}

      {/* Dải thông báo ngữ cảnh nổi bật bên dưới */}
      <div
        className={`family-current-context-bar ${mode === 'BOOKING' ? 'is-booking-mode' : ''}`}
      >
        <div className="family-context-text">
          <UserOutlined style={{ color: mode === 'BOOKING' ? '#2563eb' : '#16a34a' }} />
          <span>
            {mode === 'BOOKING' ? (
              <>
                Đang đặt lịch cho:{' '}
                <span className="family-context-patient-highlight">
                  {activeProfile?.fullName}
                </span>{' '}
                <Tag color={activeProfile?.self ? 'blue' : 'green'} style={{ marginLeft: 6 }}>
                  {formatProfileRelationship(activeProfile?.relationship, activeProfile?.self)}
                  {activeProfile?.age ? ` - ${activeProfile.age} tuổi` : ''}
                </Tag>
              </>
            ) : isViewAll ? (
              <>
                Đang xem lịch hẹn của:{' '}
                <span className="family-context-patient-highlight">
                  Tất cả người thân liên kết
                </span>
              </>
            ) : (
              <>
                Đang xem lịch hẹn của:{' '}
                <span className="family-context-patient-highlight">
                  {activeProfile?.fullName}
                </span>{' '}
                <Tag color={activeProfile?.self ? 'blue' : 'green'} style={{ marginLeft: 6 }}>
                  {formatProfileRelationship(activeProfile?.relationship, activeProfile?.self)}
                  {activeProfile?.age ? ` - ${activeProfile.age} tuổi` : ''}
                </Tag>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export default FamilyProfileSwitcher
