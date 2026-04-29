import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import axios from 'axios'; // Add this import for reverse geocoding
import {
    Container,
    Paper,
    TextField,
    Button,
    Typography,
    Box,
    Link,
    Alert,
    CircularProgress,
    Divider,
    Grid,
    InputAdornment,
    IconButton,
    MenuItem
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    PersonAdd as PersonAddIcon,
    MyLocation as LocationIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';

// Philippine regions and provinces data
const philippineProvinces = [
    'Metro Manila', 'Cebu', 'Davao del Sur', 'Cavite', 'Laguna',
    'Batangas', 'Rizal', 'Bulacan', 'Pampanga', 'Nueva Ecija',
    'Pangasinan', 'Benguet', 'Iloilo', 'Negros Occidental', 'Leyte',
    'Zamboanga del Sur', 'Misamis Oriental', 'Davao del Norte', 'South Cotabato'
];

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        street: '',
        barangay: '',
        city: '',
        province: '',
        zip_code: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Get current GPS location
    const getCurrentLocation = () => {
        setLocating(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const response = await axios.get(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
                        );
                        const address = response.data.address;
                        setFormData(prev => ({
                            ...prev,
                            street: address.road || address.street || '',
                            barangay: address.neighbourhood || address.suburb || '',
                            city: address.city || address.municipality || address.town || '',
                            province: address.state || address.province || '',
                            zip_code: address.postcode || ''
                        }));
                        toast.success('Location detected!');
                    } catch (error) {
                        toast.warning('Location detected but address lookup failed');
                    }
                    setLocating(false);
                },
                (error) => {
                    toast.error('Could not get location. Please enter address manually.');
                    setLocating(false);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            toast.error('Geolocation is not supported by your browser');
            setLocating(false);
        }
    };

        const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        // Validation checks (keep your existing ones)
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }
    

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            setLoading(false);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address');
            setLoading(false);
            return;
        }
        
         try {
        const { confirmPassword, ...registrationData } = formData;
        
        // 🔥 UPDATED: Use relative URL
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        toast.success('Registration submitted! Please wait for admin approval.');
        
        // Clear form
        setFormData({
            name: '', email: '', phone: '', street: '', barangay: '',
            city: '', province: '', zip_code: '', password: '', confirmPassword: ''
        });
        
        // Redirect to login
        setTimeout(() => navigate('/login'), 2000);
        
    } catch (error) {
        const errorMessage = error.message || 'Registration failed';
        setError(errorMessage);
        toast.error(errorMessage);
    } finally {
        setLoading(false);
    }
};

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    return (
        <Container component="main" maxWidth="md">
            <Box sx={{ marginTop: 4, marginBottom: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <PersonAddIcon sx={{ fontSize: 50, color: 'primary.main', mb: 1 }} />
                        <Typography component="h1" variant="h5" gutterBottom>
                            Create Your Account
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            Register for the GPS Debt Collection System
                        </Typography>
                    </Box>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}
                    
                    <Box component="form" onSubmit={handleSubmit}>
                        {/* Personal Information */}
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            Personal Information
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField required fullWidth label="Full Name" name="name"
                                    value={formData.name} onChange={handleChange} disabled={loading} />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField required fullWidth label="Email Address" name="email"
                                    type="email" value={formData.email} onChange={handleChange} disabled={loading} />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField fullWidth label="Phone Number" name="phone"
                                    value={formData.phone} onChange={handleChange} disabled={loading}
                                    placeholder="09XX-XXX-XXXX" />
                            </Grid>
                        </Grid>

                        {/* Philippine Address */}
                        <Box sx={{ mt: 3, mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    Philippine Address
                                </Typography>
                                <Button
                                    size="small"
                                    startIcon={<LocationIcon />}
                                    onClick={getCurrentLocation}
                                    disabled={locating}
                                    variant="outlined"
                                >
                                    {locating ? 'Detecting...' : 'Use My Location'}
                                </Button>
                            </Box>
                        </Box>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <TextField fullWidth label="Street/Building/House No." name="street"
                                    value={formData.street} onChange={handleChange} disabled={loading}
                                    placeholder="123 Rizal Street" />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField fullWidth label="Barangay" name="barangay"
                                    value={formData.barangay} onChange={handleChange} disabled={loading}
                                    placeholder="Barangay San Antonio" />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField fullWidth label="City/Municipality" name="city"
                                    value={formData.city} onChange={handleChange} disabled={loading}
                                    placeholder="Makati City" />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField select fullWidth label="Province" name="province"
                                    value={formData.province} onChange={handleChange} disabled={loading}>
                                    {philippineProvinces.map(province => (
                                        <MenuItem key={province} value={province}>{province}</MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField fullWidth label="ZIP Code" name="zip_code"
                                    value={formData.zip_code} onChange={handleChange} disabled={loading}
                                    placeholder="1200" />
                            </Grid>
                        </Grid>

                        {/* Password */}
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3 }} gutterBottom>
                            Password
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField required fullWidth label="Password" name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password} onChange={handleChange} disabled={loading}
                                    helperText="At least 6 characters"
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }} />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField required fullWidth label="Confirm Password" name="confirmPassword"
                                    type="password" value={formData.confirmPassword} onChange={handleChange}
                                    disabled={loading}
                                    error={formData.confirmPassword && formData.password !== formData.confirmPassword}
                                    helperText={formData.confirmPassword && formData.password !== formData.confirmPassword ? 'Passwords do not match' : ''} />
                            </Grid>
                        </Grid>
                        
                        <Button type="submit" fullWidth variant="contained" size="large"
                            sx={{ mt: 3, mb: 2 }} disabled={loading}>
                            {loading ? <CircularProgress size={24} color="inherit" /> : 'Submit Registration'}
                        </Button>
                        
                        <Box sx={{ textAlign: 'center' }}>
                            <Link href="/login" variant="body2" underline="hover">
                                Already have an account? Sign in
                            </Link>
                        </Box>
                    </Box>
                </Paper>
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="textSecondary">
                        Your address helps us assign the nearest collector for efficient service.
                    </Typography>
                </Box>
            </Box>
        </Container>
    );
};

export default Register;