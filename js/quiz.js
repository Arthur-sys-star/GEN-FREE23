/* =========================================
   GEN-FREE QUIZ LOGIC
   Four rotating sets of five questions.
   A random set + random question/option order is selected on each page load.
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const quizSets = [
        {
            name: "Awareness Basics",
            questions: [
                { question: "Which area can be affected by drug misuse?", options: ["Only physical health", "Only education", "Only friendships", "Multiple areas of life"], correct: "d", explanation: "Substance misuse can affect health, mental well-being, education, career, relationships, and other areas of life." },
                { question: "Why is it important to question claims about drugs?", options: ["Because all information online is false", "Because myths can influence harmful decisions", "Because facts are not important", "Because everyone has the same experience"], correct: "b", explanation: "Checking reliable information can help people recognise misinformation and make more informed choices." },
                { question: "What is a healthy response when someone pressures you to try a substance?", options: ["Try it to fit in", "Stay silent even if uncomfortable", "Clearly say no and leave the situation if needed", "Pressure someone else instead"], correct: "c", explanation: "You can communicate your boundary, leave the situation, and stay around supportive people." },
                { question: "What can peer pressure make someone feel?", options: ["A need to fit in or follow others", "That consequences do not exist", "That they must always be right", "That they should never make their own decisions"], correct: "a", explanation: "Peer pressure can create a desire to fit in. Recognising it can help you make decisions based on your own values." },
                { question: "Does asking for help mean someone is weak?", options: ["Yes, always", "No, asking for help can be a sign of strength", "Only students should avoid asking for help", "It depends entirely on other people's opinions"], correct: "b", explanation: "Reaching out for support can be a positive step when someone is facing pressure or substance-related difficulties." }
            ]
        },
        {
            name: "Risk & Effects",
            questions: [
                { question: "Which is a possible effect of substance misuse?", options: ["Better judgement in risky situations", "Improved concentration for everyone", "Impaired judgement and unsafe situations", "Guaranteed better academic results"], correct: "c", explanation: "Substance misuse can impair judgement and may increase the chance of accidents or unsafe situations." },
                { question: "How can substance misuse affect education or work?", options: ["It can interfere with responsibilities and performance", "It always improves attendance", "It has no possible effect", "It guarantees career progress"], correct: "a", explanation: "Substance-related problems can interfere with responsibilities, studies, work performance, and future opportunities." },
                { question: "Which statement about drug effects is most accurate?", options: ["Every person reacts in exactly the same way", "Risks can vary by substance, person, situation, and use", "Only illegal substances can create risks", "A single experience is automatically risk-free"], correct: "b", explanation: "Effects and risks can vary depending on the substance and individual circumstances." },
                { question: "Which area may be affected by long-term substance problems?", options: ["Relationships and trust", "Only hobbies", "Only clothing choices", "Nothing outside physical health"], correct: "a", explanation: "Substance-related problems can place pressure on friendships, family relationships, and trust." },
                { question: "Why can impaired judgement be dangerous?", options: ["It guarantees safer choices", "It can make risky situations harder to recognise", "It always increases reaction time", "It removes every possible consequence"], correct: "b", explanation: "Impaired judgement can make it harder to recognise risks and respond safely." }
            ]
        },
        {
            name: "Peer Pressure & Support",
            questions: [
                { question: "What is one useful way to handle direct pressure?", options: ["Clearly communicate your decision", "Accept immediately", "Hide your feelings", "Encourage more pressure"], correct: "a", explanation: "A clear and confident response can help you maintain your boundaries when someone pressures you." },
                { question: "What can you do if pressure continues?", options: ["Stay in the situation no matter what", "Leave and move toward a safer environment", "Try the substance to end the conversation", "Pressure another person instead"], correct: "b", explanation: "Leaving a pressured situation can be a practical way to remove yourself from unwanted pressure." },
                { question: "Who could be a source of support?", options: ["Only strangers online", "A trusted friend, family member, teacher, counsellor, or qualified professional", "Only the person applying pressure", "Nobody"], correct: "b", explanation: "Trusted people and qualified support services can help someone handle difficult situations." },
                { question: "What is a supportive response when a friend shares a substance-related concern?", options: ["Shame them", "Ignore them", "Listen without judging and encourage appropriate support", "Spread the story to others"], correct: "c", explanation: "Listening calmly and encouraging appropriate support can help someone take a positive next step." },
                { question: "What is a healthy reason to build supportive friendships?", options: ["They can make it easier to handle stress and pressure", "They remove every difficult situation", "They guarantee that nobody disagrees", "They make risky behaviour necessary"], correct: "a", explanation: "Supportive relationships can provide encouragement and healthier ways to manage pressure." }
            ]
        },
        {
            name: "Healthy Choices",
            questions: [
                { question: "Which is a healthier way to cope with everyday stress?", options: ["Exercise or another constructive activity", "Using substances to escape every problem", "Ignoring every difficult feeling", "Pressuring others to copy you"], correct: "a", explanation: "Movement, hobbies, rest, social support, and other constructive strategies can provide healthier coping options." },
                { question: "Why are regular sleep habits useful?", options: ["They can support concentration, mood, and daily functioning", "They guarantee perfect health", "They replace the need for food", "They make risky decisions safer"], correct: "a", explanation: "Regular sleep supports concentration, mood, learning, and everyday functioning." },
                { question: "What is a practical healthy routine?", options: ["Regular meals, hydration, movement, and sleep", "Skipping sleep whenever possible", "Using substances whenever stressed", "Avoiding all social support"], correct: "a", explanation: "Basic routines around sleep, food, hydration, movement, and support can contribute to overall well-being." },
                { question: "What is the main goal of GEN-FREE?", options: ["To encourage experimentation", "To provide drug-related entertainment", "To promote awareness, prevention, and informed choices", "To judge people who need help"], correct: "c", explanation: "GEN-FREE focuses on awareness, prevention, informed decision-making, and encouraging people to seek support when needed." },
                { question: "What should you do when you are unsure whether drug-related information is reliable?", options: ["Share it immediately", "Check credible sources and question the claim", "Assume it is true because it sounds confident", "Ignore every source"], correct: "b", explanation: "Checking credible information and questioning unsupported claims can reduce misinformation." }
            ]
        }
    ];

    const questionText = document.getElementById("question-text");
    const options = [...document.querySelectorAll(".quiz-option")];
    const currentQuestionElement = document.getElementById("current-question");
    const totalQuestionsElement = document.getElementById("total-questions");
    const progressFill = document.getElementById("quiz-progress-fill");
    const feedback = document.getElementById("quiz-feedback");
    const feedbackTitle = document.getElementById("feedback-title");
    const feedbackText = document.getElementById("feedback-text");
    const nextButton = document.getElementById("quiz-next");
    const scoreElement = document.getElementById("quiz-score");
    const quizCard = document.getElementById("quiz-card");
    const quizResult = document.getElementById("quiz-result");
    const finalScore = document.getElementById("final-score");
    const resultTitle = document.getElementById("result-title");
    const resultMessage = document.getElementById("result-message");
    const restartButton = document.getElementById("restart-quiz");

    if (!questionText || options.length !== 4 || !nextButton) return;

    let selectedSet = null;
    let questions = [];
    let currentQuestion = 0;
    let score = 0;
    let answered = false;
    let answers = [];

    function shuffle(items) {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function chooseRandomSet() {
        selectedSet = quizSets[Math.floor(Math.random() * quizSets.length)];
        questions = shuffle(selectedSet.questions).map((item) => {
            const optionObjects = item.options.map((label, index) => ({ label, correct: String.fromCharCode(97 + index) === item.correct }));
            const shuffledOptions = shuffle(optionObjects);
            const correctIndex = shuffledOptions.findIndex((item) => item.correct);
            return {
                ...item,
                options: shuffledOptions.map((item) => item.label),
                correct: String.fromCharCode(97 + correctIndex)
            };
        });
    }

    function updateScore() {
        scoreElement.textContent = `Score: ${score}/${questions.length}`;
    }

    function loadQuestion() {
        answered = false;
        const question = questions[currentQuestion];
        currentQuestionElement.textContent = String(currentQuestion + 1).padStart(2, "0");
        totalQuestionsElement.textContent = questions.length;
        questionText.textContent = question.question;
        progressFill.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
        options.forEach((option, index) => {
            const letter = String.fromCharCode(65 + index);
            option.innerHTML = `<span class="option-letter">${letter}</span><span>${question.options[index]}</span>`;
            option.dataset.answer = letter.toLowerCase();
            option.classList.remove("selected", "correct", "incorrect");
            option.disabled = false;
        });
        feedback.classList.remove("show");
        feedbackTitle.textContent = "Good to know";
        feedbackText.textContent = "Select an answer to see the explanation.";
        nextButton.disabled = true;
        nextButton.textContent = currentQuestion === questions.length - 1 ? "Finish Quiz" : "Next Question →";
        updateScore();
    }

    function startQuiz() {
        chooseRandomSet();
        currentQuestion = 0;
        score = 0;
        answers = [];
        quizResult.classList.remove("show");
        removeGuestNote();
        quizCard.style.display = "block";
        const setName = document.getElementById("quiz-set-name");
        if (setName) setName.textContent = selectedSet.name;
        loadQuestion();
    }

    let pendingAttempt = null;

    function removeGuestNote() {
        document.querySelectorAll(".gf-guest-note").forEach((node) => node.remove());
    }

    function showGuestNote() {
        if (document.querySelector(".gf-guest-note")) return;
        const box = document.createElement("div");
        box.className = "gf-feedback gf-guest-note";
        box.innerHTML = "<strong>Save this score</strong><span>Log in or create a free profile and this result is added to your progress.</span>";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary-button";
        button.textContent = "Log in to save";
        button.addEventListener("click", () => { if (window.GENFREE) window.GENFREE.showAuthModal("login"); });
        box.appendChild(button);
        quizResult.appendChild(box);
    }

    // Points: full points for the first completed quiz, a small bonus only when the best score is beaten.
    function storeAttempt(attempt) {
        const user = window.GENFREE.getUser();
        const hadAttempt = !!(user && Array.isArray(user.quizAttempts) && user.quizAttempts.length);
        const previousBest = user && user.quizBest ? Number(user.quizBest.score) : null;
        const improved = previousBest !== null && attempt.score > previousBest;
        window.GENFREE.updateUser((u) => {
            u.quizAttempts = Array.isArray(u.quizAttempts) ? u.quizAttempts : [];
            u.quizAttempts.push(attempt);
            if (!u.quizBest || attempt.score > u.quizBest.score || (attempt.score === u.quizBest.score && attempt.timestamp > u.quizBest.timestamp)) {
                u.quizBest = attempt;
            }
        });
        window.GENFREE.addActivity("quiz_completed", `${attempt.setName}: ${attempt.score}/${attempt.total}`, {
            once: false,
            award: !hadAttempt || improved,
            points: hadAttempt ? 5 : 20
        });
    }

    function saveAttempt() {
        const attempt = {
            setName: selectedSet.name,
            score,
            total: questions.length,
            percentage: Math.round((score / questions.length) * 100),
            answers,
            timestamp: new Date().toISOString()
        };
        if (window.GENFREE && window.GENFREE.getUser && window.GENFREE.getUser()) {
            storeAttempt(attempt);
            return;
        }
        pendingAttempt = attempt;
        showGuestNote();
    }

    window.addEventListener("genfree:login", () => {
        if (!pendingAttempt || !window.GENFREE || !window.GENFREE.getUser()) return;
        const attempt = pendingAttempt;
        pendingAttempt = null;
        storeAttempt(attempt);
        removeGuestNote();
    });

    function showResult() {
        quizCard.style.display = "none";
        quizResult.classList.add("show");
        finalScore.textContent = `${score}/${questions.length}`;
        const percentage = Math.round((score / questions.length) * 100);
        if (score >= 5) {
            resultTitle.textContent = "Excellent Awareness";
            resultMessage.textContent = "You completed a full GEN-FREE awareness set. Keep questioning myths and applying healthy choices in real life.";
        } else if (score >= 3) {
            resultTitle.textContent = "Good Start";
            resultMessage.textContent = "You have a useful foundation. Explore the awareness and risk sections to strengthen your knowledge.";
        } else {
            resultTitle.textContent = "Keep Learning";
            resultMessage.textContent = "Every question is an opportunity to improve your awareness. Review the GEN-FREE resources and try another set.";
        }
        const setScore = document.getElementById("result-set-name");
        if (setScore) setScore.textContent = `${selectedSet.name} • ${percentage}%`;
        saveAttempt();
    }

    options.forEach((option) => {
        option.addEventListener("click", () => {
            if (answered) return;
            answered = true;
            const selectedAnswer = option.dataset.answer;
            const question = questions[currentQuestion];
            const isCorrect = selectedAnswer === question.correct;
            if (isCorrect) score++;
            answers.push({ question: currentQuestion + 1, selected: selectedAnswer, correct: isCorrect, timestamp: new Date().toISOString() });
            options.forEach((item) => { item.disabled = true; if (item.dataset.answer === question.correct) item.classList.add("correct"); });
            option.classList.add("selected");
            if (!isCorrect) option.classList.add("incorrect");
            feedbackTitle.textContent = isCorrect ? "Correct ✓" : "Not quite";
            feedbackText.textContent = question.explanation;
            feedback.classList.add("show");
            nextButton.disabled = false;
            updateScore();
        });
    });

    nextButton.addEventListener("click", () => {
        if (!answered) return;
        if (currentQuestion < questions.length - 1) {
            currentQuestion++;
            loadQuestion();
        } else {
            showResult();
        }
    });

    restartButton?.addEventListener("click", startQuiz);

    startQuiz();
});
