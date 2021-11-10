#!/bin/bash
sudo yum update -y
sudo yum install -y docker
sudo usermod -a -G docker ec2-user
sudo systemctl enable docker && sudo systemctl start docker
su - ec2-user
docker run -d -p 80:8080 -h=`hostname` tedytirta/testcgk
