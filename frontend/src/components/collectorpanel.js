import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Container, Grid, Paper, Typography, Box, Button, TextField,
    List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent,
    DialogActions, AppBar, Toolbar, IconButton, Chip, Card, CardContent,
    Alert, Divider
} from '@mui/material';
import {
    ExitToApp as LogoutIcon, MyLocation as LocationIcon,
    Navigation as NavigationIcon, Phone as PhoneIcon,
    Home as HomeIcon, Payments as PaymentIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const CollectorPanel = () => {
    const [assignedBorrowers, setAssignedBorrowers] = useState([]);
    const [selectedBorrower, setSelectedBorrower] = useState(null);
    const [paymentDialog, setPaymentDialog] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [loans, setLoans] = useState([]);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [gpsLocation, setGpsLocation] = useState({ latitude: null, longitude: null });
    const [gpsAccuracy, setGpsAccuracy] = useState(null);
    const [trackingGPS, setTrackingGPS] = useState(false);
    const [nearbyBorrowers, setNearbyBorrowers] = useState([]);
    const [routeInfo, setRouteInfo] = useState(null);
    const watchIdRef = useRef(null);

    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchAssignedBorrowers();
        startGPSTracking();
        return () => stopGPSTracking();
    }, []);

    const startGPSTracking = () => {
        if (navigator.geolocation) {
            setTrackingGPS(true);
            // Initial position
            navigator.geolocation.getCurrentPosition(
                (position) => updateLocation(position),
                (error) => {
                    console.error('GPS Error:', error);
                    toast.warning('GPS not available. Please enable location services.');
                    setTrackingGPS(false);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
            // Watch position for real-time tracking
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => updateLocation(position),
                (error) => console.error('GPS Watch Error:', error),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, distanceFilter: 5 }
            );
        }
    };

    const stopGPSTracking = () => {
        if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            setTrackingGPS(false);
        }
    };

    const updateLocation = (position) => {
        const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };
        setGpsLocation(newLocation);
        setGpsAccuracy(position.coords.accuracy);
        
        // Save GPS to backend
        saveGPSLocation(newLocation);
        
        // Find nearby borrowers
        findNearbyBorrowers(newLocation);
    };

    const saveGPSLocation = async (location) => {
        try {
            await axios.post('http://localhost:5000/api/gps/collector-location', {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: gpsAccuracy
            }, config);
        } catch (error) {
            console.error('Error saving GPS:', error);
        }
    };

    const fetchAssignedBorrowers = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/borrowers/assigned', config);
            setAssignedBorrowers(response.data);
        } catch (error) {
            toast.error('Error fetching assigned borrowers');
        }
    };

    const findNearbyBorrowers = (location) => {
        const nearby = assignedBorrowers.filter(borrower => {
            if (borrower.gps_latitude && borrower.gps_longitude) {
                const distance = calculateDistance(
                    location.latitude, location.longitude,
                    borrower.gps_latitude, borrower.gps_longitude
                );
                borrower.distance = distance;
                return distance <= 10; // Within 10 km
            }
            return false;
        });
        nearby.sort((a, b) => a.distance - b.distance);
        setNearbyBorrowers(nearby);
    };

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const openGoogleMapsDirections = (borrower) => {
        if (gpsLocation.latitude && borrower.gps_latitude) {
            const url = `https://www.google.com/maps/dir/?api=1&origin=${gpsLocation.latitude},${gpsLocation.longitude}&destination=${borrower.gps_latitude},${borrower.gps_longitude}&travelmode=driving`;
            window.open(url, '_blank');
        } else if (borrower.address) {
            const url = `https://www.google.com/maps/dir/?api=1&origin=${gpsLocation.latitude},${gpsLocation.longitude}&destination=${encodeURIComponent(borrower.address)}&travelmode=driving`;
            window.open(url, '_blank');
        }
    };

    const handleBorrowerSelect = async (borrower) => {
        setSelectedBorrower(borrower);
        try {
            const response = await axios.get('http://localhost:5000/api/loans', config);
            const borrowerLoans = response.data.filter(
                loan => loan.borrower_id === borrower.borrower_id && loan.status === 'active'
            );
            setLoans(borrowerLoans);
        } catch (error) {
            toast.error('Error fetching loans');
        }
    };

    const handleRecordPayment = async () => {
        if (!selectedLoan || !paymentAmount) {
            toast.error('Please select a loan and enter amount');
            return;
        }

        try {
            const paymentData = {
                loan_id: selectedLoan.loan_id,
                amount: parseFloat(paymentAmount),
                latitude: gpsLocation.latitude,
                longitude: gpsLocation.longitude
            };

            const response = await axios.post('http://localhost:5000/api/payments', paymentData, config);
            toast.success(`Payment recorded! Receipt: ${response.data.receipt_number}`);
            setPaymentDialog(false);
            setPaymentAmount('');
            setSelectedLoan(null);
            fetchAssignedBorrowers();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Error recording payment');
        }
    };

    const updateBorrowerGPS = async (borrowerId) => {
        if (!gpsLocation.latitude) {
            toast.warning('GPS location not available');
            return;
        }
        try {
            await axios.post('http://localhost:5000/api/gps/location', {
                latitude: gpsLocation.latitude,
                longitude: gpsLocation.longitude,
                borrower_id: borrowerId
            }, config);
            toast.success('Borrower location updated');
            fetchAssignedBorrowers();
        } catch (error) {
            toast.error('Error updating location');
        }
    };

    const handleLogout = () => {
        stopGPSTracking();
        localStorage.clear();
        navigate('/login');
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Collector Panel
                    </Typography>
                    <Chip 
                        icon={<LocationIcon />}
                        label={trackingGPS ? 'GPS Active' : 'GPS Inactive'}
                        color={trackingGPS ? 'success' : 'error'}
                        size="small"
                        sx={{ mr: 2 }}
                    />
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
                    {/* GPS Status Card */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box>
                                    <Typography variant="h6">📍 GPS Location Status</Typography>
                                    <Typography>
                                        {gpsLocation.latitude ? 
                                            `Lat: ${gpsLocation.latitude.toFixed(6)}, Lng: ${gpsLocation.longitude.toFixed(6)}` : 
                                            'Acquiring GPS...'}
                                    </Typography>
                                    {gpsAccuracy && (
                                        <Typography variant="caption" color="textSecondary">
                                            Accuracy: ±{gpsAccuracy.toFixed(1)} meters
                                        </Typography>
                                    )}
                                </Box>
                                <Button 
                                    variant="outlined" 
                                    startIcon={<NavigationIcon />}
                                    onClick={() => {
                                        if (gpsLocation.latitude) {
                                            window.open(`https://www.google.com/maps?q=${gpsLocation.latitude},${gpsLocation.longitude}`, '_blank');
                                        }
                                    }}
                                    disabled={!gpsLocation.latitude}
                                >
                                    View on Map
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Nearby Borrowers */}
                    {nearbyBorrowers.length > 0 && (
                        <Grid item xs={12}>
                            <Paper sx={{ p: 2, bgcolor: '#e8f5e9' }}>
                                <Typography variant="h6" gutterBottom>
                                    📍 Nearby Borrowers (within 10km)
                                </Typography>
                                <Grid container spacing={2}>
                                    {nearbyBorrowers.map(borrower => (
                                        <Grid item xs={12} md={4} key={borrower.borrower_id}>
                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {borrower.full_name}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary">
                                                        {borrower.distance.toFixed(1)} km away
                                                    </Typography>
                                                    <Typography variant="caption">
                                                        {borrower.address || 'No address'}
                                                    </Typography>
                                                    <Box sx={{ mt: 1 }}>
                                                        <Button 
                                                            size="small" 
                                                            variant="contained"
                                                            onClick={() => openGoogleMapsDirections(borrower)}
                                                            startIcon={<NavigationIcon />}
                                                            sx={{ mr: 1 }}
                                                        >
                                                            Directions
                                                        </Button>
                                                        <Button 
                                                            size="small"
                                                            onClick={() => handleBorrowerSelect(borrower)}
                                                        >
                                                            View Loans
                                                        </Button>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Paper>
                        </Grid>
                    )}

                    {/* Assigned Borrowers List */}
                    <Grid item xs={12} md={5}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                👥 Assigned Borrowers ({assignedBorrowers.length})
                            </Typography>
                            <List>
                                {assignedBorrowers.map((borrower) => (
                                    <ListItem
                                        key={borrower.borrower_id}
                                        button
                                        selected={selectedBorrower?.borrower_id === borrower.borrower_id}
                                        onClick={() => handleBorrowerSelect(borrower)}
                                        sx={{ border: '1px solid #eee', mb: 1, borderRadius: 1 }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    {borrower.full_name}
                                                    {borrower.distance && (
                                                        <Chip 
                                                            label={`${borrower.distance.toFixed(1)} km`} 
                                                            size="small" 
                                                            color="primary"
                                                            sx={{ ml: 1 }}
                                                        />
                                                    )}
                                                </Box>
                                            }
                                            secondary={
                                                <Box>
                                                    <Typography variant="caption">
                                                        <HomeIcon sx={{ fontSize: 14, mr: 0.5 }} />
                                                        {borrower.address || 'No address recorded'}
                                                    </Typography>
                                                    {borrower.phone && (
                                                        <Typography variant="caption" display="block">
                                                            <PhoneIcon sx={{ fontSize: 14, mr: 0.5 }} />
                                                            {borrower.phone}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                        />
                                        <Box>
                                            <Button
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateBorrowerGPS(borrower.borrower_id);
                                                }}
                                                disabled={!gpsLocation.latitude}
                                                sx={{ mr: 1 }}
                                            >
                                                📍 GPS
                                            </Button>
                                            <Button
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openGoogleMapsDirections(borrower);
                                                }}
                                                startIcon={<NavigationIcon />}
                                            >
                                                Go
                                            </Button>
                                        </Box>
                                    </ListItem>
                                ))}
                            </List>
                        </Paper>
                    </Grid>

                    {/* Loan Details & Payment */}
                    <Grid item xs={12} md={7}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                {selectedBorrower ? 
                                    `💰 Loans for ${selectedBorrower.full_name}` : 
                                    'Select a borrower to view loans'}
                            </Typography>
                            
                            {selectedBorrower && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    <HomeIcon sx={{ fontSize: 16, mr: 1 }} />
                                    {selectedBorrower.address || 'No address on file'}
                                </Alert>
                            )}
                            
                            {loans.length === 0 && selectedBorrower && (
                                <Alert severity="warning">No active loans for this borrower</Alert>
                            )}
                            
                            {loans.map((loan) => (
                                <Box 
                                    key={loan.loan_id} 
                                    sx={{ 
                                        p: 2, mb: 2, border: '1px solid #eee', borderRadius: 1,
                                        backgroundColor: selectedLoan?.loan_id === loan.loan_id ? '#e3f2fd' : 'white'
                                    }}
                                >
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="textSecondary">Loan Amount</Typography>
                                            <Typography variant="h6">₱{parseFloat(loan.loan_amount).toLocaleString()}</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="textSecondary">Balance</Typography>
                                            <Typography variant="h6" color="error">
                                                ₱{parseFloat(loan.balance).toLocaleString()}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="textSecondary">Interest Rate</Typography>
                                            <Typography>{loan.interest_rate}%</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="textSecondary">Due Date</Typography>
                                            <Typography>
                                                {new Date(loan.due_date).toLocaleDateString('en-PH', {
                                                    year: 'numeric', month: 'long', day: 'numeric'
                                                })}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                    <Button
                                        variant="contained"
                                        startIcon={<PaymentIcon />}
                                        sx={{ mt: 1 }}
                                        onClick={() => {
                                            setSelectedLoan(loan);
                                            setPaymentDialog(true);
                                        }}
                                        disabled={loan.balance <= 0}
                                        fullWidth
                                    >
                                        Record Payment
                                    </Button>
                                </Box>
                            ))}
                        </Paper>
                    </Grid>
                </Grid>

                {/* Payment Dialog */}
                <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)}>
                    <DialogTitle>💵 Record Payment</DialogTitle>
                    <DialogContent>
                        {selectedLoan && (
                            <>
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    Balance: ₱{parseFloat(selectedLoan.balance).toLocaleString()}
                                </Alert>
                                <TextField
                                    autoFocus
                                    margin="dense"
                                    label="Payment Amount (₱)"
                                    type="number"
                                    fullWidth
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    InputProps={{
                                        inputProps: { min: 0, max: selectedLoan.balance, step: "0.01" },
                                        startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography>
                                    }}
                                />
                                {gpsLocation.latitude && (
                                    <Box sx={{ mt: 2, p: 1, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                                        <Typography variant="caption">
                                            📍 Payment Location: {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
                                        </Typography>
                                    </Box>
                                )}
                            </>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
                        <Button onClick={handleRecordPayment} variant="contained"
                            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}>
                            Confirm Payment
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
};

export default CollectorPanel;