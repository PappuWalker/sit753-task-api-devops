pipeline {

    agent any

    options {
        timeout(time: 20, unit: 'MINUTES')
    }

    environment {
        DOCKER_IMAGE = 'simple-task-api'
        SONAR_HOST_URL = 'http://localhost:9000'
    }

    stages {

        stage('1. Build') {
            steps {
                echo 'Building the application and Docker image...'

                bat 'npm install'

                bat """
                    docker build ^
                    -t ${DOCKER_IMAGE}:${BUILD_NUMBER}-${GIT_COMMIT.substring(0, 7)} ^
                    -t ${DOCKER_IMAGE}:latest .
                """
            }
        }

       stage('2. Automated Test') {
    steps {
        echo 'Running automated tests...'

        bat 'npm run test:ci'
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'junit.xml'
        }
    }
}

        stage('3. Code Quality') {
            steps {
                echo 'Running SonarQube code quality analysis...'

                withCredentials([
                    string(
                        credentialsId: 'sonarqube-token',
                        variable: 'SONAR_TOKEN'
                    )
                ]) {
                    bat """
                        npx sonarqube-scanner ^
                        -Dsonar.host.url=${SONAR_HOST_URL} ^
                        -Dsonar.login=%SONAR_TOKEN% ^
                        -Dsonar.qualitygate.wait=true
                    """
                }
            }
        }

        stage('4. Security Scan') {
            steps {
                echo 'Checking dependencies and Docker image for vulnerabilities...'

                bat 'npm audit --audit-level=high'

                bat """
                    docker run --rm ^
                    -v //var/run/docker.sock:/var/run/docker.sock ^
                    aquasec/trivy:latest ^
                    image ^
                    --severity HIGH,CRITICAL ^
                    --format table ^
                    ${DOCKER_IMAGE}:${BUILD_NUMBER}-${GIT_COMMIT.substring(0, 7)}
                """

                bat """
                    docker run --rm ^
                    -v //var/run/docker.sock:/var/run/docker.sock ^
                    aquasec/trivy:latest ^
                    image ^
                    --severity CRITICAL ^
                    --ignore-unfixed ^
                    --exit-code 1 ^
                    ${DOCKER_IMAGE}:${BUILD_NUMBER}-${GIT_COMMIT.substring(0, 7)}
                """
            }
        }

        stage('5. Deploy to Staging') {
            steps {
                echo 'Deploying the application to staging...'

                bat 'docker rm -f simple-task-api-staging || exit 0'

                // Jenkins uses the standalone Docker Compose command.
                bat 'docker-compose up -d staging'

                bat 'timeout /t 10 /nobreak'

                bat """
                    powershell -Command "try {
                        \$response = Invoke-WebRequest `
                            -Uri http://localhost:5001/health `
                            -UseBasicParsing

                        if (\$response.StatusCode -ne 200) {
                            exit 1
                        }
                    }
                    catch {
                        exit 1
                    }"
                """

                echo 'Staging deployment completed successfully.'
            }
        }

        stage('6. Release to Production') {
            steps {
                echo 'Releasing the application to production...'

                bat 'docker rm -f simple-task-api-production || exit 0'

                bat 'docker-compose up -d production'

                bat 'timeout /t 10 /nobreak'

                bat """
                    powershell -Command "try {
                        \$response = Invoke-WebRequest `
                            -Uri http://localhost:5000/health `
                            -UseBasicParsing

                        if (\$response.StatusCode -ne 200) {
                            exit 1
                        }
                    }
                    catch {
                        exit 1
                    }"
                """

                echo 'Production release completed successfully.'
            }

            post {
                failure {
                    echo 'Production deployment failed. Attempting rollback...'

                    bat 'docker rm -f simple-task-api-production || exit 0'

                    bat 'docker-compose up -d production || exit 0'
                }
            }
        }

        stage('7. Monitoring & Alerting') {
            steps {
                echo 'Starting monitoring and alerting...'

                bat 'docker-compose up -d prometheus'

                bat 'timeout /t 10 /nobreak'

                echo 'Checking Prometheus...'

                bat """
                    powershell -Command "try {
                        \$response = Invoke-WebRequest `
                            -Uri http://localhost:9090/-/healthy `
                            -UseBasicParsing

                        if (\$response.StatusCode -ne 200) {
                            exit 1
                        }
                    }
                    catch {
                        exit 1
                    }"
                """

                echo 'Checking application metrics...'

                bat """
                    powershell -Command "try {
                        \$response = Invoke-WebRequest `
                            -Uri http://localhost:5000/metrics `
                            -UseBasicParsing

                        if (\$response.StatusCode -ne 200) {
                            exit 1
                        }
                    }
                    catch {
                        exit 1
                    }"
                """

                echo 'Monitoring checks completed successfully.'
            }
        }
    }

    post {

        success {
            echo 'Pipeline completed successfully.'
            echo 'All seven DevOps stages have completed.'
        }

        failure {
            echo 'Pipeline failed. Please check the Jenkins console output.'
        }

        always {
            echo 'Pipeline execution finished.'
        }
    }
}