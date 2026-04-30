import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
            // Axios returns data directly, no need for .json() or .ok
            const response = await axios.post('/api/auth/login', formData);
            const data = response.data;  // Data is in response.data for axios
            
            // Store token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('userRole', data.user.role);
            localStorage.setItem('userName', data.user.name);
            localStorage.setItem('userId', data.user.user_id);
            
            // Update auth state
            if (setIsAuthenticated) setIsAuthenticated(true);
            if (setUserRole) setUserRole(data.user.role);
            
            toast.success('Login successful!');
            
            // Redirect based on role
            switch(data.user.role) {
                case 'admin':
                    navigate('/admin');
                    break;
                case 'collector':
                    navigate('/collector');
                    break;
                case 'borrower':
                    navigate('/borrower');
                    break;
                default:
                    navigate('/dashboard');
            }
            
        } catch (error) {
            // Axios errors are in error.response
            const errorMessage = error.response?.data?.error || error.message || 'Login failed. Please try again.';
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
