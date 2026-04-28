import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Container,
    Grid,
    Paper,
    Typography,
    Box,
    Button,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    AppBar,
    Toolbar,
    IconButton
} from '@mui/material';
import { ExitToApp as LogoutIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const BorrowerPanel = () => {
    const [loans, setLoans] = useState([]);
    const [payments, setPayments] = useState([]);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchBorrowerData();
    }, []);

    const fetchBorrowerData = async () => {
        try {
            const [loansRes, paymentsRes] = await Promise.all([
                axios.get('http://localhost:5000/api/loans/status', config),
                axios.get('http://localhost:5000/api/payments', config)
            ]);
            
            setLoans(loansRes.data);
            setPayments(paymentsRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const getTotalOutstanding = () => {
        return loans.reduce((total, loan) => total + (loan.balance || 0), 0);
    };

    const getNextPaymentDue = () => {
        const activeLoans = loans.filter(loan => loan.status === 'active');
        if (activeLoans.length === 0) return 'No active loans';
        const nextDue = activeLoans.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
        return new Date(nextDue.due_date).toLocaleDateString();
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Borrower Panel
                    </Typography>
                    <Button color="inherit" onClick={() => navigate('/dashboard')}>
                        Dashboard
                    </Button>
                    <IconButton color="inherit" onClick={handleLogout}>
                        <LogoutIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Grid container spacing={3}>
                    {/* Summary Cards */}
                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary">Active Loans</Typography>
                                <Typography variant="h4">
                                    {loans.filter(l => l.status === 'active').length}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary">Total Outstanding</Typography>
                                <Typography variant="h4">
                                    Php {getTotalOutstanding().toLocaleString()}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary">Next Payment Due</Typography>
                                <Typography variant="h6">{getNextPaymentDue()}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Loan Status */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                My Loans
                            </Typography>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Loan Amount</TableCell>
                                            <TableCell>Balance</TableCell>
                                            <TableCell>Total Paid</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Due Date</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loans.map((loan) => (
                                            <TableRow key={loan.loan_id}>
                                                <TableCell>Php {loan.loan_amount}</TableCell>
                                                <TableCell>Php {loan.balance || loan.outstanding_balance}</TableCell>
                                                <TableCell>Php {loan.total_paid || 0}</TableCell>
                                                <TableCell>
                                                    <Box sx={{ 
                                                        color: loan.status === 'active' ? 'success.main' : 'text.primary'
                                                    }}>
                                                        {loan.status}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(loan.due_date).toLocaleDateString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>

                    {/* Payment History */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                Payment History
                            </Typography>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Amount</TableCell>
                                            <TableCell>Receipt Number</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {payments.map((payment) => (
                                            <TableRow key={payment.payment_id}>
                                                <TableCell>
                                                    {new Date(payment.payment_date).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>Php{payment.amount}</TableCell>
                                                <TableCell>{payment.receipt_number || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default BorrowerPanel;