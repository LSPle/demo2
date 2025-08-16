import React from 'react';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { useLocation } from 'react-router-dom';
import './PageTransition.css';

const PageTransition = ({ children }) => {
  const location = useLocation();

  return (
    <TransitionGroup className="page-transition-group">
      <CSSTransition
        key={location.pathname}
        classNames="page"
        timeout={600}
        unmountOnExit
      >
        <div className="page-wrapper">
          {children}
        </div>
      </CSSTransition>
    </TransitionGroup>
  );
};

export default PageTransition;