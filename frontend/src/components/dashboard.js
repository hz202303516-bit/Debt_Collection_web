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
    IconButton,
    CircularProgress,
    Alert,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemText,
    Badge
} from '@mui/material';
import {
    Person as PersonIcon,
    Payment as PaymentIcon,
    AccountBalance as LoanIcon,
    ExitToApp as LogoutIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Refresh as RefreshIcon,
    Notifications as NotificationsIcon
} from '@mui/icons-material';

const Dashboard = ({ userRole }) => {
    const [stats, setStats] = useState({
        totalLoans: 0,
        totalPayments: 0,
        totalBorrowers: 0,
        activeLoans: 0,
        overdueLoans: 0,
        totalCollected: 0,
        recentPayments: [],
        recentLoans: [],
        collectionRate: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const navigate = useNavigate();
    const userName = localStorage.getItem('userName');

    useEffect(() => {
        fetchDashboardData();
        // Auto-refresh every 5 minutes
        const interval = setInterval(fetchDashboardData, 300000);
        return () => clearInterval(interval);
    }, [userRole]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const API_BASE = process.env.REACT_APP_API_URL || '';

            // Fetch all necessary data
            const [loansRes, paymentsRes, borrowersRes] = await Promise.all([
                axios.get(`${API_BASE}/api/loans`, config),
                axios.get(`${API_BASE}/api/payments`, config),
                axios.get(`${API_BASE}/api/borrowers`, config).catch(() => ({ data: [] }))
            ]);

            // Process loans data
            const loans = loansRes.data.rows || loansRes.data || [];
            const activeLoans = Array.isArray(loans) 
                ? loans.filter(loan => loan.status === 'active' || loan.status === 'approved')
                : [];
            const overdueLoans = Array.isArray(loans) 
                ? loans.filter(loan => {
                    if (loan.status === 'overdue') return true;
                    if (loan.due_date) return new Date(loan.due_date) < new Date();
                    return false;
                })
                : [];

            // Process payments data
            const payments = paymentsRes.data.rows || paymentsRes.data || [];
            const totalCollected = Array.isArray(payments) 
                ? payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                : 0;
            const recentPayments = Array.isArray(payments) 
                ? payments.slice(0, 5) 
                : [];

            // Calculate collection rate
            const totalLoanAmount = Array.isArray(loans) 
                ? loans.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)
                : 0;
            const collectionRate = totalLoanAmount > 0 
                ? ((totalCollected / totalLoanAmount) * 100).toFixed(1)
                : 0;

            setStats({
                totalLoans: loansRes.data.total || (Array.isArray(loans) ? loans.length : 0),
                totalPayments: paymentsRes.data.total || (Array.isArray(payments) ? payments.length : 0),
                totalBorrowers: borrowersRes.data.total || (Array.isArray(borrowersRes.data) ? borrowersRes.data.length : 0),
                activeLoans: activeLoans.length,
                overdueLoans: overdueLoans.length,
                totalCollected,
                recentPayments,
                recentLoans: Array.isArray(loans) ? loans.slice(0, 5) : [],
                collectionRate
            });
            
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            setError('Failed to load dashboard data. Please try again.');
            // Keep existing stats if available
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const getPanelByRole = () => {
        switch(userRole) {
            case 'admin': return '/admin';
            case 'collector': return '/collector';
            case 'borrower': return '/borrower';
            default: return '/dashboard';
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2
        }).format(amount);
    };

    const getStatusColor = (status) => {
        switch(status?.toLowerCase()) {
            case 'active':
            case 'approved': return 'success';
            case 'overdue': return 'error';
            case 'pending': return 'warning';
            default: return 'default';
        }
    };

    if (loading && !stats.totalLoans) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Debt Collection System
                    </Typography>
                    <IconButton color="inherit" onClick={fetchDashboardData} sx={{ mr: 1 }}>
                        <RefreshIcon />
                    </IconButton>
                    <Typography variant="subtitle1" sx={{ mr: 2 }}>
                        Welcome, {userName} ({userRole})
                    </Typography>
                    <IconButton color="inherit" onClick={handleLogout}>
                        <LogoutIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {lastUpdated && (
                    <Typography variant="caption" color="textSecondary" sx={{ mb: 2, display: 'block' }}>
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </Typography>
                )}

                <Grid container spacing={3}>
                    {/* Summary Cards */}
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <LoanIcon sx={{ mr: 1, color: 'primary.main' }} />
                                    <Typography variant="h6">Total Loans</Typography>
                                </Box>
                                <Typography variant="h4">{stats.totalLoans}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {stats.activeLoans} active • {stats.overdueLoans} overdue
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <PaymentIcon sx={{ mr: 1, color: 'success.main' }} />
                                    <Typography variant="h6">Total Payments</Typography>
                                </Box>
                                <Typography variant="h4">{stats.totalPayments}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {formatCurrency(stats.totalCollected)} collected
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <PersonIcon sx={{ mr: 1, color: 'warning.main' }} />
                                    <Typography variant="h6">Borrowers</Typography>
                                </Box>
                                <Typography variant="h4">{stats.totalBorrowers}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Active in system
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <TrendingUpIcon sx={{ mr: 1, color: 'info.main' }} />
                                    <Typography variant="h6">Collection Rate</Typography>
                                </Box>
                                <Typography variant="h4">{stats.collectionRate}%</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Of total loan amount
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Recent Payments */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Recent Payments
                            </Typography>
                            {stats.recentPayments.length === 0 ? (
                                <Typography color="textSecondary">No recent payments</Typography>
                            ) : (
                                <List>
                                    {stats.recentPayments.map((payment, index) => (
                                        <React.Fragment key={payment.id || index}>
                                            <ListItem>
                                                <ListItemText
                                                    primary={formatCurrency(payment.amount)}
                                                    secondary={`Borrower: ${payment.borrower_name || 'N/A'} • ${new Date(payment.payment_date).toLocaleDateString()}`}
                                                />
                                            </ListItem>
                                            {index < stats.recentPayments.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            )}
                        </Paper>
                    </Grid>

                    {/* Recent Loans */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Recent Loans
                            </Typography>
                            {stats.recentLoans.length === 0 ? (
                                <Typography color="textSecondary">No recent loans</Typography>
                            ) : (
                                <List>
                                    {stats.recentLoans.map((loan, index) => (
                                        <React.Fragment key={loan.id || index}>
                                            <ListItem>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            {formatCurrency(loan.amount)}
                                                            <Chip 
                                                                label={loan.status || 'active'} 
                                                                size="small" 
                                                                color={getStatusColor(loan.status)}
                                                            />
                                                        </Box>
                                                    }
                                                    secondary={`Borrower: ${loan.borrower_name || 'N/A'} • ${loan.created_at ? new Date(loan.created_at).toLocaleDateString() : 'N/A'}`}
                                                />
                                            </ListItem>
                                            {index < stats.recentLoans.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            )}
                        </Paper>
                    </Grid>

                    {/* Quick Actions */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="h6" gutterBottom>
                                Quick Actions
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Button 
                                    variant="contained" 
                                    size="large"
                                    onClick={() => navigate(getPanelByRole())}
                                >
                                    Go to {userRole} Panel
                                </Button>
                                <Button 
                                    variant="outlined" 
                                    size="large"
                                    onClick={fetchDashboardData}
                                    startIcon={<RefreshIcon />}
                                >
                                    Refresh Data
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default Dashboard;
