/**
 * Created by jbblanc on 19/05/2016.
 */


const generatePassword = require('password-generator')
const jwToken = require('../helpers/jwToken')
const bcrypt = require('bcrypt')
const db = require('../config/db').db
const _ = require('lodash')
const crypto = require('crypto-js')

function beforeCreate(user,cb) {
    bcrypt.genSalt(10, function (err, salt) {
        if (err) return cb(err);
        bcrypt.hash(user.password, salt, function (err, hash) {
            if (err) return cb(err);
            user.encryptedPassword = hash;
            delete user.password;
            if(user['password_verify']) delete user['password_verify'];
            cb(null,user);
        })
    })
}

function comparePassword(password,user,cb){
    bcrypt.compare(password, user.encryptedPassword, function (err, match) {
        if(err) cb(err);
        if(match) {
            cb(null, true);
        } else {
            cb(err);
        }
    })
}

function displayName(user) {
    return user.firstName +' '+ user.lastName;
}

function getGravatarUrl(user) {
    return 'https://www.gravatar.com/avatar/'+crypto.MD5(user.email).toString()+'.jpg';
}

function toJSON(user) {
    delete user.encryptedPassword;
    delete user.autogenerated;
    user.displayName = displayName(user);
    if(user.email){
        user.picture = getGravatarUrl(user);
    }
    return user;
}

module.exports = function(app){


    app.post('/api/user', function(req, res){
        req.body.autogenerated = false;
        req.body.owner = true;
        if (req.body.password && req.body.password !== req.body.password_verify) {
            return res.status(401).json({error: 'Password doesn\'t match, What a shame!'});
        }
        if (!req.body.firstName) {
            return res.status(401).json({error: 'FirstName not provided, What a shame!'});
        }
        if (!req.body.password) {
            return res.status(401).json({error: 'Password is needed, What a shame!'});
        }
        beforeCreate(req.body,function(err,user){
            if(!err){
                db.users.insert(user,function (err, user) {
                    if(err)  return res.status(401).json({err: err});
                    if (user) {
                        return res.status(200).json({user: toJSON(user), token: jwToken.issue({id: user._id})});
                    }
                });
            }
        })
    });

    app.post('/api/auth/user/member', function(req, res){
        req.body.autogenerated = false;
        req.body.owner = false;
        if (req.body.password && req.body.password !== req.body.password_verify) {
            return res.status(401).json({error: 'Password doesn\'t match, What a shame!'});
        }
        if (!req.body.firstName) {
            return res.status(401).json({error: 'FirstName not provided, What a shame!'});
        }
        if (!req.body.password) {
            req.body.autogenerated = true;
            req.body.password = generatePassword(12, false);
        }
        beforeCreate(req.body,function(err,user){
            if(!err){
                db.users.insert(user,function (err, user) {
                    if(err)  return res.status(401).json({err: err});
                    if (user) {
                        return res.status(200).json(toJSON(user));
                    }
                });
            }
        })
    });

    app.delete('/api/auth/user/member/:id', function(req, res){
        if (!req.params['id']) {
            return res.status(401).json({error: 'id not provided, What a shame!'});
        }

        db.users.remove({ _id: req.params['id'] }, {}, function (err, numRemoved) {
            if (err) {
                return res.status(401).json({err: err});
            }
            return res.status(200)
        });
    });

    app.get('/api/auth/user/', function(req, res){
        db.users.find({}, function (err, users) {
            _.forEach(users,function(user){
                user = toJSON(user)
            }) ;
            return res.status(200).json(users);
        });

    });

    app.get('/api/auth/user/:id', function(req, res){
        db.users.findOne({_id : req.params['id']}, function (err, user) {
            return res.status(200).json(toJSON(user));
        });
    });

    app.get('/api/user/unique', function(req, res){
        db.users.findOne({email : req.query.value}, function (err, user) {
            if(err) return res.status(401).json(err);
            var value = {};
            value.isValid =  _.isEmpty(user);
            value.value = req.query.value;
            return res.status(200).json(value);
        });
    });

    app.post('/api/auth/user/changepassword', function(req, res){
       // todo implement passwrod change
    });


    app.post('/api/user/login', function(req, res){
        var email = req.body.email;
        var password = req.body.password;

        if (!email || !password) {
            return res.status(401).json({error: 'email and password required'});
        }
        db.users.findOne({ email  : req.body.email}, function (err, user) {
            if (!user) {
                return res.status(401).json({error: 'invalid email or password'});
            }
            comparePassword(password, user, function (err, valid) {
                if (err) {
                    return res.status(403).json({error: 'forbidden'});
                }

                if (!valid) {
                    return res.status(401).json({error: 'invalid email or password'});
                } else {
                    res.status(200).json({
                        user: toJSON(user),
                        token: jwToken.issue({id: user._id})
                    });
                }
            });
        });
    });
    app.post('/api/auth/user/:id', function(req, res){
        if (!req.params['id']) {
            return res.status(401).json({error: 'id not provided, What a shame!'});
        }

        db.users.update({ _id: req.params['id']},req.body, {}, function (err) {
            if (err) {
                return res.status(401).json({err: err});
            }
            return res.status(200).json(req.body);
        });

    });
};
