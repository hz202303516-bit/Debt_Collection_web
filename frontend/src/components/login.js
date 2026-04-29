import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
    Container,
    Paper,
    TextField,
    Button,
    Typography,
    Box,
    Link,
    Alert,
    CircularProgress
} from '@mui/material';
import { toast } from 'react-toastify';

const Login = ({ setIsAuthenticated, setUserRole }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            // 🔥 THIS IS THE MISSING API CALL - ADDED NOW
            const response = await api.post('/api/auth/login', formData);
            
            const { token, user } = response.data;
            
            // Store user data in localStorage
            localStorage.setItem('token', token);
            localStorage.setItem('userRole', user.role);
            localStorage.setItem('userName', user.name);
            localStorage.setItem('userId', user.user_id);
            
            // Check if user is approved
            if (user.status === 'pending') {
                toast.warning('Your account is pending approval. Please wait for admin approval.');
                localStorage.clear();
                navigate('/login');
                return;
            }
            
            if (user.status === 'rejected') {
                toast.error('Your account has been rejected. Please contact admin.');
                localStorage.clear();
                navigate('/login');
                return;
            }
            
            // Update auth state
            if (setIsAuthenticated) setIsAuthenticated(true);
            if (setUserRole) setUserRole(user.role);
            
            toast.success('Login successful!');
            
            // Redirect based on role
            switch(user.role) {
                case 'admin':
                    navigate('/admin/dashboard');
                    break;
                case 'collector':
                    navigate('/collector/dashboard');
                    break;
                case 'borrower':
                    navigate('/borrower/dashboard');
                    break;
                default:
                    navigate('/dashboard');
            }
            
        } catch (error) {
            const errorMessage = error.response?.data?.error || 'Login failed. Please check your credentials.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (error) setError('');
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
                    <Typography component="h1" variant="h5" align="center" gutterBottom>
                        GPS Debt Collection System
                    </Typography>
                    <Typography component="h2" variant="h6" align="center" color="textSecondary" gutterBottom>
                        Login
                    </Typography>
                    
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}
                    
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Email Address"
                            name="email"
                            autoComplete="email"
                            autoFocus
                            value={formData.email}
                            onChange={handleChange}
                            disabled={loading}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type="password"
                            autoComplete="current-password"
                            value={formData.password}
                            onChange={handleChange}
                            disabled={loading}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
                        </Button>
                        <Box sx={{ textAlign: 'center' }}>
                            <Link href="/register" variant="body2">
                                Don't have an account? Register
                            </Link>
                        </Box>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default Login;