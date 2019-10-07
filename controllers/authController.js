const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
    failureRedirect:  '/login',
    failureFlash: 'Failed Log In',
    successRedirect: '/',
    successFlash: 'You are now logged in'
});

exports.logout = (req, res) => {
    req.logout();
    req.flash('success', 'You are now logged out.');
    res.redirect('/');
};

exports.isLoggedIn = (req, res, next) => {
    if(req.isAuthenticated()){
        next();
        return;
    }
    req.flash('error', 'Oops, you must be logged in to do that.')
    res.redirect('/login');
};

exports.forgot = async (req,res) => {
    const user = await User.findOne({email: req.body.email});
    if(!user){
        req.flash('success', 'A password email has been made to you.');
        return res.redirect('/login');
    }
    user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordExpires = Date.now() + 3600000;

    await user.save();

    const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;

    await mail.send({
        user,
        subject: 'Password Reset',
        resetURL,
        filename: 'password-reset'
    });
    req.flash('success', `An email with password reset link has been sent to ${req.body.email}`);

    res.redirect('/login');
};

exports.reset = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {$gt: Date.now()}
    });
    if(!user){
        req.flash('error', 'Password token invalid or has expired');
        return res.redirect('/login');
    }
    res.render('reset', {title: 'Reset Your Password'});
};

exports.confirmedPasswords = (req, res, next) => {
    if(req.body.password === req.body['password-confirm']){
        next();
        return;
    }
    req.flash('error', 'Passwords did not match');
    res.redirect('back');
};

exports.update = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {$gt: Date.now()}
    });
    if(!user){
        req.flash('error', 'Password token invalid or has expired');
        return res.redirect('/login');
    }
    
    const setPassword = promisify(user.setPassword, user);
    await setPassword(req.body.password);
    user.resetPasswordExpires = undefined;
    user.resetPasswordToken = undefined;
    const updatedUser = await user.save();

    await req.login(updatedUser);

    req.flash('success', 'Your new password has been reset');
    res.redirect('/');

}