import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Login from './components/login';
import Register from './components/register';
import Dashboard from './components/dashboard';
import AdminPanel from './components/adminpanel';
import CollectorPanel from './components/collectorpanel';
import BorrowerPanel from './components/borrowerpanel';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
        background: {
            default: '#f5f5f5',
        },
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
});

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userRole, setUserRole] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('userRole');
        if (token) {
            setIsAuthenticated(true);
            setUserRole(role);
        }
    }, []);

    const PrivateRoute = ({ children, allowedRoles }) => {
        if (!isAuthenticated) {
            return <Navigate to="/login" />;
        }
        if (allowedRoles && !allowedRoles.includes(userRole)) {
            return <Navigate to="/dashboard" />;
        }
        return children;
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Router>
                <Routes>
                    <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} setUserRole={setUserRole} />} />
                    <Route path="/register" element={<Register />} />
                    <Route 
                        path="/dashboard" 
                        element={
                            <PrivateRoute>
                                <Dashboard userRole={userRole} />
                            </PrivateRoute>
                        } 
                    />
                    <Route 
                        path="/admin/*" 
                        element={
                            <PrivateRoute allowedRoles={['admin']}>
                                <AdminPanel />
                            </PrivateRoute>
                        } 
                    />
                    <Route 
                        path="/collector/*" 
                        element={
                            <PrivateRoute allowedRoles={['collector']}>
                                <CollectorPanel />
                            </PrivateRoute>
                        } 
                    />
                    <Route 
                        path="/borrower/*" 
                        element={
                            <PrivateRoute allowedRoles={['borrower']}>
                                <BorrowerPanel />
                            </PrivateRoute>
                        } 
                    />
                    <Route path="/" element={<Navigate to="/login" />} />
                </Routes>
            </Router>
            <ToastContainer position="top-right" autoClose={3000} />
        </ThemeProvider>
    );
}

export default App;