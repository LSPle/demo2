import React from 'react';
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import { useLocation } from 'react-router-dom';
import './PageTransition.css';

const PageTransition = ({ children }) => {
  const location = useLocation();

  return (
    <SwitchTransition mode="out-in">
      <CSSTransition
        key={location.pathname}
        classNames="page"
        timeout={320}
        unmountOnExit
      >
        <div className="page-wrapper">
          {children}
        </div>
      </CSSTransition>
    </SwitchTransition>
  );
};

export default PageTransition;