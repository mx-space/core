set -e
cd ../../assets
# rm -rf .git
# git init
git pull
git add .
git commit -m 'update assets'
git remote add origin git@github.com:mx-space/assets.git
# git branch -M master
git push -u origin master -f
# rm -rf .git
