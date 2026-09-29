import React from 'react'
import { Link } from 'react-router-dom'

function PortalCyberHeader({ activePage, hideNav = false }) {
  const shouldHideNav =
    hideNav || activePage === 'register' || activePage === 'forgot-password'

  return (
    <header>
      <Link to="/portal" className="brand">
        <i className="brand-icon">
          <svg className="ic"><use href="#folder" /></svg>
        </i>
        <div>
          <b>BỆNH ÁN SỐ</b>
          <small>Cổng thông tin bệnh nhân trực tuyến</small>
        </div>
      </Link>
      {!shouldHideNav && (
        <nav>
          {activePage !== 'lookup' && (
            <Link to="/portal" className="navlink">
              <svg className="ic"><use href="#search" /></svg>
              <span className="t">Tra cứu theo mã hẹn</span>
            </Link>
          )}
          {activePage !== 'login' && (
            <Link to="/portal/login" className="navlink">
              <svg className="ic"><use href="#lock" /></svg>
              <span className="t">Đăng nhập Bệnh nhân</span>
            </Link>
          )}
          {activePage !== 'register' && (
            <Link to="/portal/register" className="navlink">
              <svg className="ic"><use href="#user" /></svg>
              <span className="t">Đăng ký</span>
            </Link>
          )}
          <Link to="/login" className="navlink">
            <svg className="ic"><use href="#user" /></svg>
            <span className="t">Đăng nhập nhân viên</span>
          </Link>
        </nav>
      )}
    </header>
  )
}

export default PortalCyberHeader
