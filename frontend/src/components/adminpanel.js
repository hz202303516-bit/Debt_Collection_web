import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Container,
    Grid,
    Paper,
    Typography,
    Box,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    AppBar,
    Toolbar,
    IconButton,
    Card,
    CardContent,
    Chip,
    Tabs,
    Tab,
    Alert,
    CircularProgress,
    TextField,
    List,
    ListItem,
    ListItemText
} from '@mui/material';
import {
    ExitToApp as LogoutIcon,
    Dashboard as DashboardIcon,
    PersonAdd as ApproveIcon,
    Cancel as RejectIcon,
    Assignment as RoleIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const AdminPanel = () => {
    const [tabValue, setTabValue] = useState(0);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [collectors, setCollectors] = useState([]);
    const [borrowers, setBorrowers] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedCollector, setSelectedCollector] = useState('');
    const [loans, setLoans] = useState([]);
    const [loanForm, setLoanForm] = useState({
        borrower_id: '',
        loan_amount: '',
        interest_rate: '',
        due_date: ''
    });
    const [stats, setStats] = useState({
        totalUsers: 0,
        pendingApprovals: 0,
        activeCollectors: 0,
        activeBorrowers: 0
    });
    const [mlStats, setMlStats] = useState({
        lowRisk: 0,
        mediumRisk: 0,
        highRisk: 0,
        totalPredictions: 0
    });
    const [predictionDialogOpen, setPredictionDialogOpen] = useState(false);
    const [currentPrediction, setCurrentPrediction] = useState(null);

    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [usersRes, assignmentsRes, loansRes] = await Promise.all([
                axios.get('http://localhost:5000/api/admin/users', config),
                axios.get('http://localhost:5000/api/admin/assignments', config),
                axios.get('http://localhost:5000/api/loans', config)
            ]);

            const allUsers = usersRes.data || [];
            
            setPendingUsers(allUsers.filter(u => u.status === 'pending'));
            setApprovedUsers(allUsers.filter(u => u.status === 'approved'));
            
            const approvedCollectors = allUsers.filter(u => u.role === 'collector' && u.status === 'approved');
            const approvedBorrowers = allUsers.filter(u => u.role === 'borrower' && u.status === 'approved');
            
            const assignmentsData = assignmentsRes.data || [];
            const collectorsWithCount = approvedCollectors.map(collector => ({
                ...collector,
                borrower_count: assignmentsData.filter(a => a.collector_id === collector.user_id).length
            }));
            
            setCollectors(collectorsWithCount);
            setBorrowers(approvedBorrowers);
            setAssignments(assignmentsData);
            setLoans(loansRes.data || []);

            setStats({
                totalUsers: allUsers.length,
                pendingApprovals: allUsers.filter(u => u.status === 'pending').length,
                activeCollectors: approvedCollectors.length,
                activeBorrowers: approvedBorrowers.length,
                totalLoans: loansRes.data?.length || 0
            });
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Error loading admin data');
        } finally {
            setLoading(false);
        }
    };

    const handleApproveUser = async (userId) => {
        try {
            await axios.put(`http://localhost:5000/api/admin/users/${userId}/approve`, {}, config);
            toast.success('User approved');
            fetchAllData();
        } catch (error) {
            toast.error('Error approving user');
        }
    };

    const handleRejectUser = async (userId) => {
        try {
            await axios.put(`http://localhost:5000/api/admin/users/${userId}/reject`, {}, config);
            toast.success('User rejected');
            fetchAllData();
        } catch (error) {
            toast.error('Error rejecting user');
        }
    };

    const handleAssignRole = async () => {
        if (!selectedRole || !selectedUser) {
            toast.error('Please select a role');
            return;
        }

        try {
            await axios.put(`http://localhost:5000/api/admin/users/${selectedUser.user_id}/assign-role`, {
                role: selectedRole
            }, config);
            
            toast.success(`Role "${selectedRole}" assigned successfully`);
            fetchAllData();
            setDialogOpen(false);
            setSelectedRole('');
        } catch (error) {
            toast.error('Error assigning role');
        }
    };

    const handleAssignCollector = async () => {
        if (!selectedCollector || !selectedUser) {
            toast.error('Please select a collector');
            return;
        }

        try {
            await axios.post('http://localhost:5000/api/admin/assign-collector', {
                borrower_user_id: selectedUser.user_id,
                collector_id: selectedCollector
            }, config);
            
            toast.success('Collector assigned successfully');
            fetchAllData();
            setDialogOpen(false);
            setSelectedCollector('');
        } catch (error) {
            toast.error('Error assigning collector');
        }
    };

    const handleCreateLoan = async () => {
        if (!loanForm.borrower_id || !loanForm.loan_amount || !loanForm.interest_rate || !loanForm.due_date) {
            toast.error('Please fill in all loan details');
            return;
        }

        try {
            const borrowerResponse = await axios.get(`http://localhost:5000/api/admin/borrower-details/${loanForm.borrower_id}`, config);
            
            if (!borrowerResponse.data || !borrowerResponse.data.borrower_id) {
                toast.error('Borrower record not found. Please make sure the user has a borrower profile.');
                return;
            }

            await axios.post('http://localhost:5000/api/loans', {
                borrower_id: borrowerResponse.data.borrower_id,
                loan_amount: parseFloat(loanForm.loan_amount),
                interest_rate: parseFloat(loanForm.interest_rate),
                due_date: loanForm.due_date
            }, config);
            
            toast.success('Loan created successfully');
            setDialogOpen(false);
            setLoanForm({ borrower_id: '', loan_amount: '', interest_rate: '', due_date: '' });
            fetchAllData();
        } catch (error) {
            console.error('Loan creation error:', error);
            toast.error(error.response?.data?.error || 'Error creating loan');
        }
    };

    const predictDefault = async (loan) => {
        try {
            const response = await axios.post('http://localhost:5001/predict', {
                loan_id: loan.loan_id,
                borrower_name: loan.borrower_name,
                loan_amount: loan.loan_amount,
                balance: loan.balance,
                interest_rate: loan.interest_rate,
                days_overdue: loan.days_overdue || 0,
                payment_count: loan.payment_count || 0,
                total_paid: loan.total_paid || 0
            });
            
            setCurrentPrediction(response.data);
            setPredictionDialogOpen(true);
            fetchMLStats();
        } catch (error) {
            try {
                const response = await axios.get(
                    `http://localhost:5000/api/loans/predict-default/${loan.loan_id}`,
                    config
                );
                setCurrentPrediction(response.data);
                setPredictionDialogOpen(true);
            } catch (err) {
                toast.error('Prediction failed');
            }
        }
    };

    const fetchMLStats = async () => {
        try {
            const response = await axios.get('http://localhost:5001/dashboard-stats');
            setMlStats({
                lowRisk: response.data.stats.low_risk,
                mediumRisk: response.data.stats.medium_risk,
                highRisk: response.data.stats.high_risk,
                totalPredictions: response.data.total_predictions
            });
        } catch (error) {
            console.log('ML service not available, using local stats');
        }
    };

    const openDialog = (type, user = null) => {
        setDialogType(type);
        setSelectedUser(user);
        setDialogOpen(true);
    };

    const openLoanDialog = (borrower = null) => {
        setDialogType('loan');
        if (borrower) {
            setLoanForm({ ...loanForm, borrower_id: borrower.user_id });
        }
        setDialogOpen(true);
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const getStatusChip = (status) => {
        const statusConfig = {
            pending: { label: 'Pending', color: 'warning' },
            approved: { label: 'Approved', color: 'success' },
            rejected: { label: 'Rejected', color: 'error' },
            pending_user: { label: 'No Role', color: 'default' },
            borrower: { label: 'Borrower', color: 'primary' },
            collector: { label: 'Collector', color: 'secondary' },
            admin: { label: 'Admin', color: 'error' }
        };
        const config = statusConfig[status] || { label: status, color: 'default' };
        return <Chip label={config.label} color={config.color} size="small" />;
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Admin Panel - System Management
                    </Typography>
                    <Button color="inherit" onClick={() => navigate('/dashboard')} startIcon={<DashboardIcon />}>
                        Dashboard
                    </Button>
                    <IconButton color="inherit" onClick={fetchAllData}>
                        <RefreshIcon />
                    </IconButton>
                    <IconButton color="inherit" onClick={handleLogout}>
                        <LogoutIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                {/* Stats Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>Total Users</Typography>
                                <Typography variant="h4">{stats.totalUsers}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: stats.pendingApprovals > 0 ? '#fff3e0' : 'white' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>Pending Approvals</Typography>
                                <Typography variant="h4" color="warning.main">{stats.pendingApprovals}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>Collectors</Typography>
                                <Typography variant="h4">{stats.activeCollectors}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>Borrowers</Typography>
                                <Typography variant="h4">{stats.activeBorrowers}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Tabs */}
                <Paper sx={{ mb: 3 }}>
                    <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
                        <Tab label={`Pending (${pendingUsers.length})`} />
                        <Tab label="Approve & Assign Roles" />
                        <Tab label="Collector Assignments" />
                        <Tab label="Create Loan" />
                        <Tab label="All Users" />
                        <Tab label="🤖 ML Predictions" />
                    </Tabs>
                </Paper>

                {/* Tab 0: Pending Approvals */}
                {tabValue === 0 && (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Pending User Approvals
                        </Typography>
                        {pendingUsers.length === 0 ? (
                            <Alert severity="info">No pending user approvals</Alert>
                        ) : (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Phone</TableCell>
                                            <TableCell>Address</TableCell>
                                            <TableCell>Registered</TableCell>
                                            <TableCell>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {pendingUsers.map((user) => (
                                            <TableRow key={user.user_id}>
                                                <TableCell>{user.name}</TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>{user.phone || 'N/A'}</TableCell>
                                                <TableCell>{user.address || 'N/A'}</TableCell>
                                                <TableCell>
                                                    {new Date(user.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        color="success"
                                                        onClick={() => handleApproveUser(user.user_id)}
                                                        sx={{ mr: 1 }}
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        color="error"
                                                        onClick={() => handleRejectUser(user.user_id)}
                                                    >
                                                        Reject
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>
                )}

                {/* Tab 1: Approve & Assign Roles */}
                {tabValue === 1 && (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Assign Roles to Approved Users
                        </Typography>
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Users must be approved first, then assigned a role (Collector or Borrower).
                        </Alert>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Current Role</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {approvedUsers.map((user) => (
                                        <TableRow key={user.user_id}>
                                            <TableCell>{user.name}</TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>{getStatusChip(user.status)}</TableCell>
                                            <TableCell>{getStatusChip(user.role)}</TableCell>
                                            <TableCell>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    startIcon={<RoleIcon />}
                                                    onClick={() => openDialog('role', user)}
                                                >
                                                    Assign Role
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                )}

                {/* Tab 2: Collector Assignments */}
                {tabValue === 2 && (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Assign Collectors to Borrowers
                        </Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={5}>
                                <Typography variant="subtitle1" gutterBottom>Collectors</Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Name</TableCell>
                                                <TableCell>Borrowers</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {collectors.map((collector) => (
                                                <TableRow key={collector.user_id}>
                                                    <TableCell>{collector.name}</TableCell>
                                                    <TableCell>
                                                        <Chip label={collector.borrower_count || 0} color="primary" size="small" />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Grid>
                            <Grid item xs={12} md={7}>
                                <Typography variant="subtitle1" gutterBottom>Borrowers Needing Assignment</Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Name</TableCell>
                                                <TableCell>Assigned Collector</TableCell>
                                                <TableCell>Action</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {borrowers.map((borrower) => (
                                                <TableRow key={borrower.user_id}>
                                                    <TableCell>{borrower.name}</TableCell>
                                                    <TableCell>{borrower.assigned_collector || 'Not assigned'}</TableCell>
                                                    <TableCell>
                                                        <Button size="small" variant="outlined" onClick={() => openDialog('assign', borrower)}>
                                                            Assign
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Grid>
                        </Grid>
                    </Paper>
                )}

                {/* Tab 3: Create Loan */}
                {tabValue === 3 && (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Create New Loan</Typography>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            Select a borrower and enter loan details.
                        </Alert>
                        
                        <Box sx={{ mb: 4, p: 3, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                            <Typography variant="subtitle1" gutterBottom fontWeight="bold">New Loan Form</Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>Select Borrower</InputLabel>
                                        <Select
                                            value={loanForm.borrower_id}
                                            onChange={(e) => setLoanForm({ ...loanForm, borrower_id: e.target.value })}
                                            label="Select Borrower"
                                        >
                                            {borrowers.length === 0 ? (
                                                <MenuItem disabled>No approved borrowers available</MenuItem>
                                            ) : (
                                                borrowers.map((borrower) => (
                                                    <MenuItem key={borrower.user_id} value={borrower.user_id}>
                                                        {borrower.name} ({borrower.email})
                                                    </MenuItem>
                                                ))
                                            )}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <TextField fullWidth label="Loan Amount (₱)" type="number"
                                        value={loanForm.loan_amount}
                                        onChange={(e) => setLoanForm({ ...loanForm, loan_amount: e.target.value })}
                                        InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography>, inputProps: { min: 0, step: "0.01" } }}
                                        helperText="Enter amount in PHP" />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <TextField fullWidth label="Interest Rate (%)" type="number"
                                        value={loanForm.interest_rate}
                                        onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })}
                                        InputProps={{ endAdornment: <Typography>%</Typography>, inputProps: { min: 0, max: 100, step: "0.1" } }}
                                        helperText="Annual interest rate" />
                                </Grid>
                                <Grid item xs={12} md={2}>
                                    <TextField fullWidth label="Due Date" type="date"
                                        value={loanForm.due_date}
                                        onChange={(e) => setLoanForm({ ...loanForm, due_date: e.target.value })}
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ min: new Date().toISOString().split('T')[0] }} />
                                </Grid>
                                <Grid item xs={12}>
                                    <Button variant="contained" size="large" onClick={handleCreateLoan}
                                        disabled={!loanForm.borrower_id || !loanForm.loan_amount || !loanForm.interest_rate || !loanForm.due_date}
                                        sx={{ mt: 1 }}>
                                        Create Loan
                                    </Button>
                                </Grid>
                            </Grid>
                        </Box>

                        <Typography variant="h6" gutterBottom>Existing Loans</Typography>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Borrower</TableCell>
                                        <TableCell>Amount</TableCell>
                                        <TableCell>Interest Rate</TableCell>
                                        <TableCell>Balance</TableCell>
                                        <TableCell>Due Date</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Created</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loans.length > 0 ? (
                                        loans.map((loan) => (
                                            <TableRow key={loan.loan_id}>
                                                <TableCell>{loan.borrower_name || 'N/A'}</TableCell>
                                                <TableCell>₱{parseFloat(loan.loan_amount).toLocaleString()}</TableCell>
                                                <TableCell>{loan.interest_rate}%</TableCell>
                                                <TableCell>₱{parseFloat(loan.balance).toLocaleString()}</TableCell>
                                                <TableCell>{new Date(loan.due_date).toLocaleDateString()}</TableCell>
                                                <TableCell>
                                                    <Chip label={loan.status} 
                                                        color={loan.status === 'active' ? 'success' : loan.status === 'paid' ? 'primary' : 'default'} 
                                                        size="small" />
                                                </TableCell>
                                                <TableCell>{new Date(loan.created_at).toLocaleDateString()}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Typography color="textSecondary">No loans created yet</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                )}

                {/* Tab 4: All Users */}
                {tabValue === 4 && (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>All Registered Users</Typography>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Role</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Phone</TableCell>
                                        <TableCell>Registered</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {[...pendingUsers, ...approvedUsers].map((user) => (
                                        <TableRow key={user.user_id}>
                                            <TableCell>{user.name}</TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>{getStatusChip(user.role)}</TableCell>
                                            <TableCell>{getStatusChip(user.status)}</TableCell>
                                            <TableCell>{user.phone || 'N/A'}</TableCell>
                                            <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                )}

                {/* Tab 5: ML Predictions */}
                {tabValue === 5 && (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            🤖 Machine Learning - Loan Default Predictions
                        </Typography>
                        
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid item xs={12} md={3}>
                                <Card sx={{ bgcolor: '#e8f5e9' }}>
                                    <CardContent>
                                        <Typography color="textSecondary">Low Risk</Typography>
                                        <Typography variant="h4" color="success.main">{mlStats.lowRisk || 0}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Card sx={{ bgcolor: '#fff3e0' }}>
                                    <CardContent>
                                        <Typography color="textSecondary">Medium Risk</Typography>
                                        <Typography variant="h4" color="warning.main">{mlStats.mediumRisk || 0}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Card sx={{ bgcolor: '#ffebee' }}>
                                    <CardContent>
                                        <Typography color="textSecondary">High Risk</Typography>
                                        <Typography variant="h4" color="error.main">{mlStats.highRisk || 0}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary">Total Predictions</Typography>
                                        <Typography variant="h4">{mlStats.totalPredictions || 0}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        <Typography variant="h6" gutterBottom>Run Predictions on Active Loans</Typography>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Borrower</TableCell>
                                        <TableCell>Loan Amount</TableCell>
                                        <TableCell>Balance</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loans.filter(l => l.status === 'active').length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center">
                                                <Typography color="textSecondary">No active loans to analyze</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        loans.filter(l => l.status === 'active').map((loan) => (
                                            <TableRow key={loan.loan_id}>
                                                <TableCell>{loan.borrower_name}</TableCell>
                                                <TableCell>₱{parseFloat(loan.loan_amount).toLocaleString()}</TableCell>
                                                <TableCell>₱{parseFloat(loan.balance).toLocaleString()}</TableCell>
                                                <TableCell><Chip label={loan.status} size="small" color="primary" /></TableCell>
                                                <TableCell>
                                                    <Button size="small" variant="contained" color="secondary"
                                                        onClick={() => predictDefault(loan)}>
                                                        🤖 Predict Default
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Prediction Result Dialog */}
                        <Dialog open={predictionDialogOpen} onClose={() => setPredictionDialogOpen(false)} maxWidth="md" fullWidth>
                            <DialogTitle>🤖 ML Prediction Results</DialogTitle>
                            <DialogContent>
                                {currentPrediction && (
                                    <Box>
                                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                                            <Box sx={{
                                                width: 150, height: 150, borderRadius: '50%',
                                                border: '8px solid',
                                                borderColor: 
                                                    currentPrediction.risk_level === 'HIGH' ? '#f44336' :
                                                    currentPrediction.risk_level === 'MEDIUM' ? '#ff9800' : '#4caf50',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                margin: 'auto'
                                            }}>
                                                <Box>
                                                    <Typography variant="h3">{currentPrediction.risk_score}%</Typography>
                                                    <Typography variant="caption">Risk Score</Typography>
                                                </Box>
                                            </Box>
                                            <Typography variant="h6" sx={{ mt: 2 }}>
                                                Risk Level: {' '}
                                                <span style={{ 
                                                    color: currentPrediction.risk_level === 'HIGH' ? '#f44336' :
                                                        currentPrediction.risk_level === 'MEDIUM' ? '#ff9800' : '#4caf50',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {currentPrediction.risk_level}
                                                </span>
                                            </Typography>
                                        </Box>

                                        <Alert severity={
                                            currentPrediction.risk_level === 'HIGH' ? 'error' :
                                            currentPrediction.risk_level === 'MEDIUM' ? 'warning' : 'success'
                                        }>
                                            <Typography variant="subtitle1" fontWeight="bold">Recommendation:</Typography>
                                            {currentPrediction.recommendation}
                                        </Alert>

                                        {currentPrediction.factors && currentPrediction.factors.length > 0 && (
                                            <>
                                                <Typography variant="subtitle1" sx={{ mt: 2 }} fontWeight="bold">Risk Factors:</Typography>
                                                <List>
                                                    {currentPrediction.factors.map((factor, index) => (
                                                        <ListItem key={index}>
                                                            <ListItemText primary={`⚠️ ${factor}`} />
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            </>
                                        )}

                                        <Typography variant="caption" color="textSecondary">
                                            Prediction Date: {currentPrediction.prediction_date || new Date().toISOString()}
                                        </Typography>
                                    </Box>
                                )}
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setPredictionDialogOpen(false)}>Close</Button>
                            </DialogActions>
                        </Dialog>
                    </Paper>
                )}

                {/* Assign Role Dialog */}
                <Dialog open={dialogOpen && dialogType === 'role'} onClose={() => setDialogOpen(false)}>
                    <DialogTitle>Assign Role to User</DialogTitle>
                    <DialogContent>
                        {selectedUser && (
                            <Box sx={{ mt: 2, minWidth: 300 }}>
                                <Typography gutterBottom>User: <strong>{selectedUser.name}</strong></Typography>
                                <Typography variant="body2" color="textSecondary" gutterBottom>{selectedUser.email}</Typography>
                                <FormControl fullWidth sx={{ mt: 2 }}>
                                    <InputLabel>Select Role</InputLabel>
                                    <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} label="Select Role">
                                        <MenuItem value="borrower">Borrower</MenuItem>
                                        <MenuItem value="collector">Collector</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssignRole} variant="contained" disabled={!selectedRole}>Assign Role</Button>
                    </DialogActions>
                </Dialog>

                {/* Assign Collector Dialog */}
                <Dialog open={dialogOpen && dialogType === 'assign'} onClose={() => setDialogOpen(false)}>
                    <DialogTitle>Assign Collector to Borrower</DialogTitle>
                    <DialogContent>
                        {selectedUser && (
                            <Box sx={{ mt: 2, minWidth: 300 }}>
                                <Typography gutterBottom>Borrower: <strong>{selectedUser.name}</strong></Typography>
                                <FormControl fullWidth sx={{ mt: 2 }}>
                                    <InputLabel>Select Collector</InputLabel>
                                    <Select value={selectedCollector} onChange={(e) => setSelectedCollector(e.target.value)} label="Select Collector">
                                        {collectors.map((collector) => (
                                            <MenuItem key={collector.user_id} value={collector.user_id}>{collector.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssignCollector} variant="contained" disabled={!selectedCollector}>Assign Collector</Button>
                    </DialogActions>
                </Dialog>

                {/* Create Loan Dialog */}
                <Dialog open={dialogOpen && dialogType === 'loan'} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Create New Loan</DialogTitle>
                    <DialogContent>
                        <Box sx={{ mt: 2 }}>
                            <Alert severity="info" sx={{ mb: 2 }}>All amounts are in Philippine Peso (PHP)</Alert>
                            <FormControl fullWidth sx={{ mb: 2 }}>
                                <InputLabel>Select Borrower</InputLabel>
                                <Select value={loanForm.borrower_id}
                                    onChange={(e) => setLoanForm({ ...loanForm, borrower_id: e.target.value })}
                                    label="Select Borrower">
                                    {borrowers.map((borrower) => (
                                        <MenuItem key={borrower.user_id} value={borrower.user_id}>{borrower.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField fullWidth label="Loan Amount" type="number"
                                value={loanForm.loan_amount}
                                onChange={(e) => setLoanForm({ ...loanForm, loan_amount: e.target.value })}
                                sx={{ mb: 2 }}
                                InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography> }} />
                            <TextField fullWidth label="Interest Rate" type="number"
                                value={loanForm.interest_rate}
                                onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })}
                                sx={{ mb: 2 }}
                                InputProps={{ endAdornment: <Typography>%</Typography> }} />
                            <TextField fullWidth label="Due Date" type="date"
                                value={loanForm.due_date}
                                onChange={(e) => setLoanForm({ ...loanForm, due_date: e.target.value })}
                                InputLabelProps={{ shrink: true }} />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateLoan} variant="contained"
                            disabled={!loanForm.borrower_id || !loanForm.loan_amount || !loanForm.interest_rate || !loanForm.due_date}>
                            Create Loan
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
};

export default AdminPanel;