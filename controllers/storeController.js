const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const multer = require('multer');
const jimp = require('jimp');
const uuid= require('uuid');

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next){
    const isPhoto = file.mimetype.startsWith('image/');
    if(isPhoto){
      next(null, true);
    } else{
      next({message: 'That filetype isn\´t allowed!'}, false);
    }
  }
};

exports.homePage = (req, res) => {
    console.log(req.name);
    req.flash('error', 'Something happened!');
    req.flash('info', 'Something happened!');
    req.flash('warning', 'Something happened!');
    req.flash('success', 'Something happened!');
    res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', {title: 'Add Store'})
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
  //Check if there is no new file to resize
  if(!req.file){
    next();
    return;
  }
  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;

  //Resize

  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);

  next();
}

exports.createStore = async (req, res) => {
  req.body.author = req.user._id
  const store = await (new Store(req.body)).save();
  req.flash('success', `Succesfully created ${store.name}. Care to leave a review?`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const stores = await Store.find();
  res.render('stores', {title:'Stores', stores: stores} );
}

const confirOwner = (store, user) => {
  if(!store.author.equals(user._id)){
    throw Error('You must own a store in order to edit it')
  }
}

exports.editStore = async (req, res) => {
  const store = await Store.findOne({_id: req.params.id})
  console.log(req)
  confirOwner(store, req.user);
  res.render('editStore', {title: `Edit ${store.name} Store`, store })
}

exports.updateStore = async (req, res) => {
  req.body.location.type = 'Point';
  const store = await Store.findOneAndUpdate({_id: req.params.id}, req.body, {
    new: true, //Return the new store instead of the old one
    runValidators: true
  }).exec();
  req.flash('success', `Succesfully updated ${store.name}. <a href='/stores/${store.slug}'>View Store</a>`);
  res.redirect(`/stores/${store._id}/edit`);
}

exports.getStoreBySlug = async (req,res, next) => {
  const store = await Store.findOne({ slug: req.params.slug}).populate('author');
  if(!store) return next();
  res.render('store', {store, title: store.name})
}

exports.getStoresByTag = async (req,res) => {
  const tag = req.params.tag;
  const tagQuery = tag || {$exists: true};
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({tags: tagQuery});
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  
  res.render('tags', {tags, title: 'Tags', tag, stores});
}

exports.searchStores = async (req, res) => {
  const stores = await Store.find({
    $text:{
      $search: req.query.q
    }
  }, {
    score: {$meta: 'textScore'}
  }).sort({
    score: {$meta: 'textScore'}
  }).limit(5);
  res.json(stores);
}
