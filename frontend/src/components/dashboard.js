import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container,
    Grid,
    Paper,
    Typography,
    Box,
    Card,
    CardContent,
    Button,
    AppBar,
    Toolbar,
    IconButton
} from '@mui/material';
import {
    Person as PersonIcon,
    Payment as PaymentIcon,
    AccountBalance as LoanIcon,
    ExitToApp as LogoutIcon
} from '@mui/icons-material';

const Dashboard = ({ userRole }) => {
    const [stats, setStats] = useState({
        totalLoans: 0,
        totalPayments: 0,
        totalBorrowers: 0,
        recentPayments: []
    });
    const navigate = useNavigate();
    const userName = localStorage.getItem('userName');

    useEffect(() => {
        fetchDashboardData();
    }, [userRole]);

    const fetchDashboardData = async () => {
    try {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };

        // 🔥 FIX: Use relative URLs or API base URL
        const API_BASE = process.env.REACT_APP_API_URL || '';
        
        const [loansRes, paymentsRes] = await Promise.all([
            axios.get(`${API_BASE}/api/loans`, config),
            axios.get(`${API_BASE}/api/payments`, config)
        ]);

        setStats({
            totalLoans: loansRes.data.length || loansRes.data.total || 0,
            totalPayments: paymentsRes.data.length || paymentsRes.data.total || 0,
            recentPayments: (paymentsRes.data.slice ? paymentsRes.data.slice(0, 5) : paymentsRes.data.rows?.slice(0, 5)) || []
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Don't crash - show empty stats
        setStats({
            totalLoans: 0,
            totalPayments: 0,
            totalBorrowers: 0,
            recentPayments: []
        });
    }
};

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const getPanelByRole = () => {
        switch(userRole) {
            case 'admin':
                return '/admin';
            case 'collector':
                return '/collector';
            case 'borrower':
                return '/borrower';
            default:
                return '/dashboard';
        }
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Debt Collection System
                    </Typography>
                    <Typography variant="subtitle1" sx={{ mr: 2 }}>
                        Welcome, {userName} ({userRole})
                    </Typography>
                    <IconButton color="inherit" onClick={handleLogout}>
                        <LogoutIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Grid container spacing={3}>
                    {/* Stats Cards */}
                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <LoanIcon sx={{ mr: 1, color: 'primary.main' }} />
                                    <Typography variant="h6">Total Loans</Typography>
                                </Box>
                                <Typography variant="h4">{stats.totalLoans}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <PaymentIcon sx={{ mr: 1, color: 'success.main' }} />
                                    <Typography variant="h6">Total Payments</Typography>
                                </Box>
                                <Typography variant="h4">{stats.totalPayments}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <PersonIcon sx={{ mr: 1, color: 'warning.main' }} />
                                    <Typography variant="h6">Quick Actions</Typography>
                                </Box>
                                <Button 
                                    variant="contained" 
                                    fullWidth 
                                    onClick={() => navigate(getPanelByRole())}
                                >
                                    Go to {userRole} Panel
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Recent Payments */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Recent Payments
                            </Typography>
                            {stats.recentPayments.map((payment, index) => (
                                <Box 
                                    key={index} 
                                    sx={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        py: 1,
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    <Typography>
                                        Amount: Php{payment.amount}
                                    </Typography>
                                    <Typography color="textSecondary">
                                        {new Date(payment.payment_date).toLocaleDateString()}
                                    </Typography>
                                </Box>
                            ))}
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default Dashboard;
